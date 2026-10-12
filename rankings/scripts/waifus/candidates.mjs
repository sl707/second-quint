// Step 2: turns the fetched series (fetch-mal.mjs) into one candidate per character: every MAIN
// character plus SUPPORTING ones with at least MIN_SUPPORTING_FAVOURITES AniList favourites
// (lib.mjs; --min-favourites N overrides), deduplicated by AniList
// character ID, female only. Gender comes from AniList; when AniList's isn't plainly Male or
// Female, the character is looked up on animecharactersdatabase.com (ACDB) by name and series, at
// most one request a second, every response cached. Still unknown: kept as "unsure" for review.
// Anime and manga (fetch-mal.mjs --type manga) are merged; each series is tagged with its type.
// Writes .cache/waifus/candidates.json.
import { readdir } from "node:fs/promises";
import {
  MIN_SUPPORTING_FAVOURITES,
  cacheDir,
  cachedJson,
  exists,
  parseArgs,
  politeFetch,
  readJson,
  sameName,
  simplify,
  writeJson,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const MIN_FAVOURITES = args["min-favourites"] !== undefined ? Number(args["min-favourites"]) : MIN_SUPPORTING_FAVOURITES;
const sources = [
  { type: "anime", list: "animelist.json", dir: "series/", id: "anime_id", eng: "anime_title_eng" },
  { type: "manga", list: "mangalist.json", dir: "manga/", id: "manga_id", eng: "manga_english" },
];

const byId = new Map();
const seriesCount = { anime: 0, manga: 0 };
for (const source of sources) {
  const listFile = new URL(source.list, cacheDir);
  if (!(await exists(listFile))) {
    console.warn(`warning: no ${source.list}; run fetch-mal.mjs --type ${source.type}`);
    continue;
  }
  const list = await readJson(listFile);
  const dir = new URL(source.dir, cacheDir);
  const files = new Set((await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json")));
  if (files.size < list.length) {
    console.warn(`warning: only ${files.size} of ${list.length} ${source.type} series fetched yet; re-run when fetch-mal.mjs is done`);
  }
  for (const entry of list) {
    const malId = entry[source.id];
    if (!files.has(`${malId}.json`)) continue;
    seriesCount[source.type]++;
    const series = await readJson(new URL(`${malId}.json`, dir));
    const titleEng = entry[source.eng] ? String(entry[source.eng]) : null;
    const titles = [series.title, titleEng].filter(Boolean).map(String);
    for (const { role, node } of series.characters) {
      if (!(role === "MAIN" || (role === "SUPPORTING" && node.favourites >= MIN_FAVOURITES))) continue;
      let c = byId.get(node.id);
      if (!c) {
        c = {
          anilistId: node.id,
          sourceId: `anilist:${node.id}`,
          name: node.name.full.trim().replace(/\s+/g, " "),
          first: node.name.first,
          last: node.name.last,
          favourites: node.favourites,
          anilistImage: node.image?.large ?? null,
          anilistUrl: node.siteUrl,
          anilistGender: node.gender,
          series: [],
        };
        byId.set(node.id, c);
      }
      c.series.push({ type: source.type, malId, title: String(series.title), titleEng, titles, role });
    }
  }
}

// ACDB answers with a "Checking browser" page until the client fetches its check image, which
// sets a NOTABOT cookie (what a browser does on that page).
let acdbCookie = null;
async function acdbGet(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (!acdbCookie) {
      const res = await politeFetch("https://www.animecharactersdatabase.com/xbotcheck-image.svg", { bucket: "acdb", gapMs: 1100 });
      acdbCookie = (res.headers.get("set-cookie") ?? "").split(";")[0] || null;
      await res.arrayBuffer();
    }
    const res = await politeFetch(url, { bucket: "acdb", gapMs: 1100, headers: acdbCookie ? { Cookie: acdbCookie } : {} });
    const text = await res.text();
    // ACDB's JSON sometimes has raw control characters and stray backslashes inside strings.
    if (text.trimStart().startsWith("{")) {
      const repaired = text.replace(/[\u0000-\u001f]+/g, " ").replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
      try {
        return JSON.parse(repaired);
      } catch {
        console.warn(`  ACDB sent unreadable JSON for ${url}; treating it as no match`);
        return { search_results: [] };
      }
    }
    if (/Checking browser/i.test(text)) {
      acdbCookie = null;
      continue;
    }
    // ACDB answers -1 when nothing matches.
    if (res.status === 404 || !text.trim() || text.trim() === "-1") return { search_results: [] };
    throw new Error(`ACDB ${res.status} for ${url}: ${text.slice(0, 200)}`);
  }
  throw new Error(`ACDB kept asking for a browser check: ${url}`);
}

const acdbSearch = (q) =>
  cachedJson("acdb", `https://www.animecharactersdatabase.com/api_series_characters.php?character_q=${encodeURIComponent(q)}`, acdbGet);

function sameSeries(acdbName, titles) {
  const a = simplify(acdbName);
  if (!a) return false;
  return titles.some((t) => {
    const b = simplify(t);
    if (!b) return false;
    if (a === b || a.includes(b) || b.includes(a)) return true;
    const x = new Set(a.split(" ")), y = new Set(b.split(" "));
    const shared = [...x].filter((w) => y.has(w) && w.length > 2).length;
    return shared / Math.min(x.size, y.size) >= 0.6;
  });
}

const plain = (g) => (g === "Female" || g === "Male" ? g : null);

async function acdbGender(c) {
  const titles = c.series.flatMap((s) => s.titles);
  const queries = [c.name];
  if (c.first && c.last) queries.push(`${c.last} ${c.first}`);
  let nameOnly = null;
  for (const q of queries) {
    const body = await acdbSearch(q);
    const results = Array.isArray(body?.search_results) ? body.search_results : [];
    const named = results.filter((r) => sameName(r.name, c.name));
    const match = named.find((r) => sameSeries(r.anime_name, titles) && plain(r.gender));
    if (match) return { gender: match.gender, note: `ACDB #${match.id} (${match.anime_name})` };
    if (named.length && !nameOnly) nameOnly = named.map((r) => `${r.anime_name}: ${r.gender || "?"}`).join("; ");
  }
  return { gender: null, note: nameOnly ? `ACDB has the name only in other series: ${nameOnly}` : "not found on ACDB" };
}

const candidates = [];
const counts = { series: seriesCount, characters: byId.size, anilistFemale: 0, acdbFemale: 0, unsure: 0, male: 0 };
const toLookUp = [...byId.values()].filter((c) => !plain(c.anilistGender)).length;
console.log(`${byId.size} characters from ${seriesCount.anime} anime and ${seriesCount.manga} manga; ${toLookUp} need ACDB (cached answers are reused)`);
let looked = 0;
for (const c of byId.values()) {
  const g = plain(c.anilistGender);
  if (g) {
    c.genderSource = "anilist";
    c.gender = g;
  } else {
    const found = await acdbGender(c);
    c.genderSource = found.gender ? "acdb" : "unsure";
    c.gender = found.gender;
    c.genderNote = [c.anilistGender ? `AniList says "${c.anilistGender}"` : "no AniList gender", found.note].join("; ");
    if (++looked % 50 === 0 || looked === toLookUp) console.log(`ACDB: ${looked}/${toLookUp} characters`);
  }
  if (c.gender === "Male") {
    counts.male++;
    continue;
  }
  if (c.genderSource === "anilist") counts.anilistFemale++;
  else if (c.genderSource === "acdb") counts.acdbFemale++;
  else counts.unsure++;
  candidates.push(c);
}

const typesOf = (c) => new Set(c.series.map((s) => s.type));
const split = (list) => ({
  animeOnly: list.filter((c) => !typesOf(c).has("manga")).length,
  mangaOnly: list.filter((c) => !typesOf(c).has("anime")).length,
  both: list.filter((c) => typesOf(c).size === 2).length,
});
counts.allCharacters = split([...byId.values()]);
counts.candidates = split(candidates);
candidates.sort((a, b) => b.favourites - a.favourites);
await writeJson(new URL("candidates.json", cacheDir), { counts, candidates });
console.log(JSON.stringify(counts));
