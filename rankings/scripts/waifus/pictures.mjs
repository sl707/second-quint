// Step 3: finds picture candidates for every candidate character (candidates.mjs): official art
// from the series' Fandom wiki, plus the AniList image as a fallback, and auto-picks the best.
//
// Finding the wiki: Wikidata maps the MAL anime ID (P4086) or manga ID (P4087) to a Fandom wiki
// ID (P4073), on the series' item or one it's based on / part of. Otherwise, wiki subdomains are guessed from the
// series titles. Either way a wiki is only used if it has pages for the series' characters.
// Finding the art: the character's page (by name in either order, else the wiki's search), its
// main page image (PageImages) and the images in its infobox, sized via imageinfo. Portrait or
// square images at least 512 px tall are preferred.
//
// Fandom publishes no rate limit; requests are serial, 0.4 s apart, batched 50 titles or files a
// request where the API allows, every response cached under
// .cache/waifus/fandom/. Writes .cache/waifus/pictures.json.
import { cacheDir, cachedJson, politeFetch, readJson, sameName, simplify, writeJson } from "./lib.mjs";

const MAX_CANDIDATES = 4; // including the AniList fallback
const MIN_GOOD_HEIGHT = 512;
const FANDOM_GAP_MS = 400;

const { candidates } = await readJson(new URL("candidates.json", cacheDir));

// --- Fandom API ----------------------------------------------------------------------------

/** One api.php GET on a wiki, cached. Null when the wiki doesn't exist. */
async function fandom(wiki, params) {
  const url = `https://${wiki}.fandom.com/api.php?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  return cachedJson("fandom", url, async () => {
    const res = await politeFetch(url, { bucket: "fandom", gapMs: FANDOM_GAP_MS, redirect: "follow" });
    if (res.status === 404 || res.status === 410) return null;
    const text = await res.text();
    if (!text.trimStart().startsWith("{")) throw new Error(`Fandom ${res.status} for ${url}: ${text.slice(0, 120)}`);
    const body = JSON.parse(text);
    // A wiki that moved redirects to its new subdomain; remember where it lives now.
    const host = new URL(res.url).host;
    return { ...body, _wiki: host.endsWith(".fandom.com") ? host.slice(0, -".fandom.com".length) : wiki };
  });
}

async function safe(promise) {
  try {
    return await promise;
  } catch (error) {
    console.warn(`  skipped: ${error.message}`);
    return null;
  }
}

/** The wiki's real subdomain, or null if there's no such English wiki. */
async function wikiExists(wiki) {
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(wiki)) return null;
  const body = await safe(fandom(wiki, { action: "query", meta: "siteinfo", siprop: "general" }));
  if (!body?.query?.general) return null;
  if (body.query.general.lang && body.query.general.lang !== "en") return null;
  return body._wiki;
}

/** Pages (with main image) for the given titles; keys are the titles asked for. */
async function lookUpTitles(wiki, titles) {
  const found = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const body = await safe(
      fandom(wiki, { action: "query", titles: batch.join("|"), redirects: "1", prop: "pageimages", piprop: "original|name" }),
    );
    if (!body?.query) continue;
    const alias = new Map();
    for (const n of body.query.normalized ?? []) alias.set(n.from, n.to);
    for (const r of body.query.redirects ?? []) alias.set(r.from, r.to);
    const resolve = (t) => {
      let seen = 0;
      while (alias.has(t) && seen++ < 5) t = alias.get(t);
      return t;
    };
    const pages = new Map((body.query.pages ?? []).filter((p) => !p.missing && !p.invalid).map((p) => [p.title, p]));
    for (const t of batch) {
      const page = pages.get(resolve(t));
      if (page) found.set(t, page);
    }
  }
  return found;
}

const nameVariants = (c) => [...new Set([c.name, c.first && c.last ? `${c.last} ${c.first}` : null].filter(Boolean))];

// --- Which wiki for which series -----------------------------------------------------------

/** Fandom wikis per series key (`anime:<MAL id>` or `manga:<MAL id>`), from Wikidata. */
async function wikidataWikis(type, malIds) {
  const property = type === "manga" ? "P4087" : "P4086";
  const result = new Map();
  for (let i = 0; i < malIds.length; i += 25) {
    const values = malIds.slice(i, i + 25).map((id) => `"${id}"`).join(" ");
    const query = `SELECT ?mal ?direct ?related WHERE { VALUES ?mal { ${values} } ?item wdt:${property} ?mal .
      OPTIONAL { ?item wdt:P4073 ?direct }
      OPTIONAL { ?item (wdt:P144|wdt:P179|wdt:P8345|wdt:P361|wdt:P155|wdt:P156)+ ?rel . ?rel wdt:P4073 ?related } }`;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`;
    const body = await safe(
      cachedJson("wikidata", url, async () => {
        const res = await politeFetch(url, { bucket: "wikidata", gapMs: 2000, headers: { Accept: "application/sparql-results+json" } });
        if (!res.ok) throw new Error(`Wikidata ${res.status}`);
        return res.json();
      }),
    );
    for (const b of body?.results?.bindings ?? []) {
      const key = `${type}:${b.mal.value}`;
      const list = result.get(key) ?? [];
      for (const w of [b.direct?.value, b.related?.value]) if (w && !list.includes(w)) list.push(w);
      result.set(key, list);
    }
  }
  return result;
}

function stripSeason(title) {
  return String(title)
    .replace(/\s*[:\-–]\s.*$/, "")
    .replace(/\((TV|\d{4})\)/gi, "")
    .replace(/\b(season|part|cour)\s*\d+\b.*$/i, "")
    .replace(/\b\d+(st|nd|rd|th)\s+season\b.*$/i, "")
    .replace(/\b(the movie|movie|ova|ona|specials?|final season)\b.*$/i, "")
    .replace(/\s+(II|III|IV|V|2|3|4|5)$/i, "")
    .trim();
}

function guessWikis(titles) {
  const guesses = [];
  for (const t of titles) {
    for (const base of [stripSeason(t), t]) {
      const words = simplify(base).split(" ").filter(Boolean);
      if (!words.length) continue;
      guesses.push(words.join(""), words.join("-"));
      if (words.length > 2) guesses.push(words.slice(0, 2).join(""), words.slice(0, 2).join("-"));
      if (words.length > 1 && words[0].length >= 5) guesses.push(words[0]);
    }
  }
  return [...new Set(guesses)].filter((g) => g.length >= 3);
}

/** How many of the series' characters have a page on `wiki`. */
async function score(wiki, characters) {
  const titles = characters.flatMap(nameVariants);
  const found = await lookUpTitles(wiki, titles);
  return characters.filter((c) => nameVariants(c).some((v) => found.has(v))).length;
}

// A wiki is confirmed by the series' best-known characters (any gender): its MAIN ones plus its
// ten most favourited SUPPORTING ones, from the series file.
const seriesKey = (s) => `${s.type ?? "anime"}:${s.malId}`;
const seriesCharacters = new Map();
const seriesTitles = new Map();
for (const c of candidates) {
  for (const s of c.series) {
    const key = seriesKey(s);
    if (seriesCharacters.has(key)) continue;
    seriesTitles.set(key, s.titles);
    const file = await readJson(new URL(`${s.type === "manga" ? "manga" : "series"}/${s.malId}.json`, cacheDir));
    const known = (role) => file.characters.filter((e) => e.role === role).map(({ node }) => ({
      name: node.name.full, first: node.name.first, last: node.name.last, favourites: node.favourites,
    }));
    const supporting = known("SUPPORTING").sort((a, b) => b.favourites - a.favourites).slice(0, 10);
    seriesCharacters.set(key, [...known("MAIN"), ...supporting]);
  }
}

const keys = [...seriesCharacters.keys()];
const idsOf = (type) => keys.filter((k) => k.startsWith(`${type}:`)).map((k) => k.slice(type.length + 1));
const fromWikidata = new Map([
  ...(await wikidataWikis("anime", idsOf("anime"))),
  ...(await wikidataWikis("manga", idsOf("manga"))),
]);
const wikiOf = new Map();
let done = 0;
for (const key of keys) {
  const characters = seriesCharacters.get(key);
  const options = [];
  for (const w of fromWikidata.get(key) ?? []) options.push({ wiki: w, trusted: true });
  for (const w of guessWikis(seriesTitles.get(key))) options.push({ wiki: w, trusted: false });
  let best = null;
  const tried = new Set();
  for (const option of options) {
    const wiki = await wikiExists(option.wiki);
    if (!wiki || tried.has(wiki)) continue;
    tried.add(wiki);
    const s = await score(wiki, characters);
    const enough = option.trusted ? s >= 1 : s >= Math.max(1, Math.ceil(characters.length * 0.3));
    if (enough && (!best || s > best.score)) best = { wiki, score: s };
    if (best && best.score === characters.length) break;
    if (best && option.trusted) break;
  }
  wikiOf.set(key, best?.wiki ?? null);
  if (++done % 25 === 0) console.log(`wikis: ${done}/${keys.length} series`);
}

// --- Art for each character ----------------------------------------------------------------

/** The page among search results whose title (minus any "(…)") is the character's name. */
async function searchPage(wiki, c) {
  const body = await safe(fandom(wiki, { action: "query", list: "search", srsearch: c.name, srlimit: "5", srnamespace: "0" }));
  const hit = (body?.query?.search ?? []).find((r) => sameName(r.title.replace(/\s*\(.*\)$/, ""), c.name));
  if (!hit) return null;
  return (await lookUpTitles(wiki, [hit.title])).get(hit.title) ?? null;
}

async function infoboxImages(wiki, title) {
  const body = await safe(fandom(wiki, { action: "parse", page: title, prop: "text", section: "0", redirects: "1" }));
  const html = typeof body?.parse?.text === "string" ? body.parse.text : "";
  const box = html.match(/<aside[^>]*portable-infobox[\s\S]*?<\/aside>/)?.[0] ?? html.match(/<table[^>]*infobox[\s\S]*?<\/table>/)?.[0] ?? "";
  return [...new Set([...box.matchAll(/data-image-name="([^"]+)"/g)].map((m) => decodeEntities(m[1])))];
}

const decodeEntities = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Size, URL, and type of each named file on `wiki`, 50 files a request. */
async function imageInfo(wiki, names) {
  const info = new Map();
  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const body = await safe(
      fandom(wiki, { action: "query", titles: batch.map((n) => `File:${n}`).join("|"), prop: "imageinfo", iiprop: "url|size|mime" }),
    );
    const pages = new Map((body?.query?.pages ?? []).filter((p) => p.imageinfo?.[0]).map((p) => [p.title, p]));
    const norm = new Map((body?.query?.normalized ?? []).map((n) => [n.from, n.to]));
    for (const n of batch) {
      const page = pages.get(norm.get(`File:${n}`) ?? `File:${n}`);
      if (page) info.set(n, { name: page.title.slice(5), ...page.imageinfo[0] });
    }
  }
  return info;
}

/** A Fandom image URL scaled down to at most `width` px wide (unchanged when not a Fandom URL). */
function scaled(url, width) {
  return url.includes("/revision/latest") ? url.replace("/revision/latest", `/revision/latest/scale-to-width-down/${width}`) : url;
}

function rate(img, position) {
  const ratio = img.height / img.width;
  let s = 0;
  if (img.height >= MIN_GOOD_HEIGHT) s += 3;
  else s += (img.height / MIN_GOOD_HEIGHT) * 2;
  if (ratio >= 1 && ratio <= 2.4) s += 2;
  else if (ratio >= 0.85) s += 1.5;
  s -= position * 0.3;
  if (/manga|chibi|icon|logo|symbol|silhouette|young|child|early/i.test(img.name)) s -= 1;
  if (/live[ _-]?action|cosplay|actress|seiyuu|voice/i.test(img.name)) s -= 3;
  if (/anime/i.test(img.name)) s += 0.3;
  return s;
}

// Pages: each character is looked for on the wikis of its series in order, all of a wiki's
// characters at once (by name in either order), then one by one through the wiki's search.
const pageOf = new Map();
const wikisOf = new Map(candidates.map((c) => [c.anilistId, [...new Set(c.series.map((s) => wikiOf.get(seriesKey(s))).filter(Boolean))]]));
let pending = candidates.filter((c) => wikisOf.get(c.anilistId).length);
for (let round = 0; pending.length; round++) {
  const byWiki = new Map();
  for (const c of pending) {
    const w = wikisOf.get(c.anilistId)[round];
    if (!w) continue;
    if (!byWiki.has(w)) byWiki.set(w, []);
    byWiki.get(w).push(c);
  }
  if (!byWiki.size) break;
  done = 0;
  for (const [wiki, chars] of byWiki) {
    const found = await lookUpTitles(wiki, chars.flatMap(nameVariants));
    for (const c of chars) {
      const v = nameVariants(c).find((n) => found.has(n));
      const page = v ? found.get(v) : await searchPage(wiki, c);
      if (page) pageOf.set(c.anilistId, { wiki, page });
      if (++done % 200 === 0) console.log(`pages (round ${round + 1}): ${done}/${pending.length} characters`);
    }
  }
  pending = pending.filter((c) => !pageOf.has(c.anilistId));
}
console.log(`pages: found for ${pageOf.size} of ${candidates.length} characters`);

// Images: each found page's main image and infobox images, then their sizes per wiki in batches.
const namesOf = new Map();
done = 0;
for (const [id, { wiki, page }] of pageOf) {
  const names = await infoboxImages(wiki, page.title);
  const main = page.pageimage?.replace(/_/g, " ");
  if (main && !names.includes(main)) names.unshift(main);
  namesOf.set(id, names.slice(0, 8));
  if (++done % 200 === 0) console.log(`infoboxes: ${done}/${pageOf.size} pages`);
}
const infoByWiki = new Map();
for (const wiki of new Set([...pageOf.values()].map((p) => p.wiki))) {
  const names = [...new Set([...pageOf].filter(([, p]) => p.wiki === wiki).flatMap(([id]) => namesOf.get(id)))];
  infoByWiki.set(wiki, await imageInfo(wiki, names));
}

const result = {};
const counts = { characters: candidates.length, withWikiArt: 0, anilistOnly: 0, pageFound: pageOf.size };
for (const c of candidates) {
  const found = pageOf.get(c.anilistId);
  const options = [];
  if (found) {
    const info = infoByWiki.get(found.wiki);
    const infos = namesOf.get(c.anilistId)
      .map((n) => info.get(n))
      .filter((i) => i && /^image\/(png|jpeg|webp|gif)$/.test(i.mime) && i.width >= 200 && i.height >= 200);
    infos.forEach((img, position) => options.push({ img, score: rate(img, position) }));
    options.sort((a, b) => b.score - a.score);
  }
  const wikiCandidates = options.slice(0, MAX_CANDIDATES - 1).map(({ img }) => ({
    source: "wiki",
    label: img.name,
    width: img.width,
    height: img.height,
    url: img.url,
    thumb: scaled(img.url, 320),
    importUrl: img.width > 1024 ? scaled(img.url, 1024) : img.url,
  }));
  const anilist = c.anilistImage
    ? [{ source: "anilist", label: "AniList", url: c.anilistImage, thumb: c.anilistImage, importUrl: c.anilistImage }]
    : [];
  const pictures = [...wikiCandidates, ...anilist];
  // The best wiki picture, unless it's too small to beat AniList's ~230 × 345.
  const pick = wikiCandidates.length && wikiCandidates[0].height >= 345 ? 0 : Math.max(0, pictures.length - 1);
  if (pictures[pick]?.source === "wiki") counts.withWikiArt++;
  else counts.anilistOnly++;
  const page = found ? `https://${found.wiki}.fandom.com/wiki/${encodeURIComponent(found.page.title.replace(/ /g, "_"))}` : null;
  result[c.anilistId] = { wiki: found?.wiki ?? null, page, pictures, pick };
}

await writeJson(new URL("pictures.json", cacheDir), { counts, pictures: result });
console.log(JSON.stringify(counts));
