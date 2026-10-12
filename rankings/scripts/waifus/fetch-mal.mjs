// Fetches a MAL user's anime (or, with --type manga, manga) list, then each series' main characters
// and supporting characters with at least MIN_SUPPORTING_FAVOURITES (lib.mjs) favourites from
// AniList (looked up by MAL id), into rankings/.cache/waifus/: animelist.json and series/, or
// mangalist.json and manga/. Re-runnable: cached series are skipped. AniList allows up to 90
// requests a minute (30 when degraded), so requests are spaced 2.1 s apart.
import { access, mkdir, writeFile } from "node:fs/promises";
import { MIN_SUPPORTING_FAVOURITES as MIN_FAVOURITES, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const user = args._[0];
const type = args.type ?? "anime";
if (!user || !["anime", "manga"].includes(type)) {
  throw new Error("Usage: node scripts/waifus/fetch-mal.mjs <mal-username> [--type anime|manga]");
}

const cacheDir = new URL("../../.cache/waifus/", import.meta.url);
const seriesDir = new URL(type === "anime" ? "series/" : "manga/", cacheDir);
await mkdir(seriesDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (url) => access(url).then(() => true, () => false);
const userAgent = "SecondQuintRankings/1.0 (rankings.secondquint.com)";

async function request(url, init, attempt = 1) {
  const res = await fetch(url, { ...init, headers: { "User-Agent": userAgent, ...init?.headers } });
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 6) throw new Error(`${res.status} for ${url}`);
    const retryAfter = Number(res.headers.get("retry-after")) || 5 * attempt;
    await sleep(retryAfter * 1000);
    return request(url, init, attempt + 1);
  }
  return res;
}

const query = `query ($idMal: Int, $page: Int, $type: MediaType) {
  Media(idMal: $idMal, type: $type) {
    id
    title { romaji english }
    characters(page: $page, perPage: 25, sort: [ROLE, FAVOURITES_DESC]) {
      pageInfo { hasNextPage }
      edges {
        role
        node { id name { full first last } gender favourites image { large } siteUrl }
      }
    }
  }
}`;

async function anilist(variables) {
  const res = await request("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { ...variables, type: type.toUpperCase() } }),
  });
  const body = await res.json();
  if (res.status === 404 || body.errors?.some((e) => e.status === 404)) return null;
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data.Media;
}

const list = [];
for (let offset = 0; ; offset += 300) {
  const res = await request(`https://myanimelist.net/${type}list/${user}/load.json?status=7&offset=${offset}`);
  const page = await res.json();
  list.push(...page);
  if (page.length < 300) break;
  await sleep(1500);
}
await writeFile(new URL(`${type}list.json`, cacheDir), JSON.stringify(list, null, 2));
console.log(`${list.length} series on ${user}'s list`);

let fetched = 0;
const malId = (entry) => entry[`${type}_id`];
for (const entry of list) {
  const file = new URL(`${malId(entry)}.json`, seriesDir);
  if (await exists(file)) continue;
  const characters = [];
  let media = null;
  for (let page = 1; ; page++) {
    media = await anilist({ idMal: malId(entry), page });
    await sleep(2100);
    if (!media) break;
    const edges = media.characters.edges;
    characters.push(...edges);
    const last = edges.at(-1);
    const done =
      !media.characters.pageInfo.hasNextPage ||
      !last ||
      last.role === "BACKGROUND" ||
      (last.role === "SUPPORTING" && last.node.favourites < MIN_FAVOURITES);
    if (done) break;
  }
  await writeFile(
    file,
    JSON.stringify({
      mal_id: malId(entry),
      anilist_id: media?.id ?? null,
      title: entry[`${type}_title`],
      status: entry.status,
      characters,
    }),
  );
  fetched++;
  if (fetched % 25 === 0) console.log(`fetched ${fetched} series`);
}
console.log(`done: fetched ${fetched} new series`);
