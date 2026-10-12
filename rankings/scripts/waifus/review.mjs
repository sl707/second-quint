// Step 4: writes .cache/waifus/review.html, one self-contained page (open it by double-click) for
// the owner to review every candidate: pick a picture, include or exclude (one by one, or every
// character shown, e.g. a whole series), then download the choices as JSON for import.mjs.
// Unsure-gender characters start excluded. Built for thousands of candidates: filters, search,
// paged rendering, lazy-loaded images. Choices are kept in the browser's localStorage, and a
// downloaded file can be loaded back to continue.
import { writeFile } from "node:fs/promises";
import { cacheDir, readJson } from "./lib.mjs";

const { counts, candidates } = await readJson(new URL("candidates.json", cacheDir));
const { counts: pictureCounts, pictures } = await readJson(new URL("pictures.json", cacheDir));

// Series as "Title (Anime)" / "Title (Manga)"; rows refer to them by index.
const seriesNames = [];
const seriesIndex = new Map();
const seriesNumber = (s) => {
  const name = `${String(s.titleEng || s.title)} (${s.type === "manga" ? "Manga" : "Anime"})`;
  if (!seriesIndex.has(name)) {
    seriesIndex.set(name, seriesNames.length);
    seriesNames.push(name);
  }
  return seriesIndex.get(name);
};

const rows = candidates.map((c) => {
  const p = pictures[c.anilistId] ?? { pictures: [], pick: 0 };
  return {
    id: c.sourceId,
    name: c.name,
    fav: c.favourites,
    series: [...new Set(c.series.map(seriesNumber))],
    media: [...new Set(c.series.map((s) => s.type ?? "anime"))].sort().join("+"),
    main: c.series.some((s) => s.role === "MAIN"),
    gs: c.genderSource,
    note: c.genderNote ?? "",
    al: c.anilistUrl,
    wiki: p.page,
    pics: p.pictures.map(({ source, label, width, height, thumb, importUrl }) => ({ s: source, l: label, w: width, h: height, t: thumb, u: importUrl })),
    pick: p.pick,
    inc: c.genderSource !== "unsure",
  };
});

const data = JSON.stringify({ generatedAt: new Date().toISOString(), counts, pictureCounts, seriesNames, rows }).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Waifu import review</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 0; background: #f4f4f5; color: #18181b; }
  header { position: sticky; top: 0; z-index: 1; background: #fff; border-bottom: 1px solid #ddd; padding: 8px 16px; }
  header .row { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; margin: 4px 0; }
  header h1 { font-size: 18px; margin: 0; }
  #count { font-weight: 700; color: #4f46e5; }
  .stats { color: #666; font-size: 12px; }
  button, select, input { font: inherit; padding: 3px 8px; }
  select#series { max-width: 340px; }
  button.primary { background: #4f46e5; color: #fff; border: 0; border-radius: 6px; padding: 5px 14px; cursor: pointer; }
  main { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 12px; padding: 16px; }
  .card { background: #fff; border-radius: 10px; padding: 10px; box-shadow: 0 1px 2px #0002; border: 2px solid #a5b4fc; }
  .card.excluded { opacity: .5; border-color: #e4e4e7; }
  .top { display: flex; justify-content: space-between; gap: 8px; align-items: start; }
  .name { font-weight: 600; font-size: 16px; }
  .series { color: #555; font-size: 12px; }
  .series a { color: inherit; text-decoration: underline dotted; cursor: pointer; }
  .badge { display: inline-block; font-size: 11px; padding: 1px 6px; border-radius: 9px; margin-right: 4px; }
  .anilist { background: #dbeafe; } .acdb { background: #dcfce7; } .unsure { background: #fee2e2; font-weight: 600; }
  .note { font-size: 11px; color: #a1a1aa; }
  .pics { display: flex; gap: 6px; margin-top: 8px; }
  .pic { width: 96px; cursor: pointer; text-align: center; font-size: 10px; color: #666; }
  .pic img { width: 96px; height: 96px; object-fit: cover; object-position: top; border-radius: 6px; border: 3px solid transparent; background: #eee; display: block; }
  .pic.chosen img { border-color: #4f46e5; }
  .pic.chosen { color: #4f46e5; font-weight: 600; }
  label.toggle { white-space: nowrap; cursor: pointer; }
  .pager { display: flex; gap: 8px; align-items: center; justify-content: center; padding: 0 16px 16px; }
  a { color: #4f46e5; }
</style>
</head>
<body>
<header>
  <div class="row">
    <h1>Waifu import review</h1>
    <span><span id="count"></span> included</span>
    <button class="primary" id="download">Download choices</button>
    <label>Load choices <input type="file" id="load" accept="application/json"></label>
    <button id="reset" title="Forget the choices saved in this browser">Reset</button>
    <span class="stats" id="stats"></span>
  </div>
  <div class="row">
    <input type="search" id="q" placeholder="Search name or series" size="24">
    <select id="series"><option value="">All series</option></select>
    <select id="gs"><option value="">Any gender source</option><option value="anilist">AniList</option><option value="acdb">ACDB</option><option value="unsure">Unsure</option></select>
    <select id="status"><option value="">Included or not</option><option value="inc">Included</option><option value="exc">Excluded</option><option value="alpic">AniList picture picked</option></select>
    <select id="media"><option value="">Anime or manga</option><option value="anime">Anime only</option><option value="manga">Manga only</option><option value="anime+manga">Both</option></select>
    <select id="role"><option value="">Main or supporting</option><option value="main">Main</option><option value="sup">Supporting only</option></select>
    <label>♥ ≥ <input type="number" id="minfav" min="0" value="0" style="width:6em"></label>
    <select id="sort"><option value="fav">Most favourited</option><option value="name">Name</option></select>
    <span id="shown"></span>
    <button id="incall">Include all shown</button>
    <button id="excall">Exclude all shown</button>
  </div>
</header>
<main id="cards"></main>
<div class="pager"><button id="prev">← Previous</button><span id="page"></span><button id="next">Next →</button></div>
<script id="data" type="application/json">${data}</script>
<script>
const data = JSON.parse(document.getElementById("data").textContent);
const PAGE = 100;
const KEY = "waifu-review:" + data.generatedAt;
const rows = data.rows, byId = new Map(rows.map((r) => [r.id, r]));
const state = Object.fromEntries(rows.map((r) => [r.id, { inc: r.inc, pick: r.pick }]));
try {
  for (const [id, s] of Object.entries(JSON.parse(localStorage.getItem(KEY) || "{}"))) {
    if (state[id] && s.pick < byId.get(id).pics.length) state[id] = s;
  }
} catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const $ = (id) => document.getElementById(id);
const label = { anilist: "AniList", acdb: "ACDB", unsure: "unsure" };
for (const r of rows) r.text = (r.name + " " + r.series.map((i) => data.seriesNames[i]).join(" ")).toLowerCase();

const seriesOrder = data.seriesNames.map((n, i) => i).sort((a, b) => data.seriesNames[a].localeCompare(data.seriesNames[b]));
function fillSeries() {
  const total = new Array(data.seriesNames.length).fill(0), inc = new Array(data.seriesNames.length).fill(0);
  for (const r of rows) for (const i of r.series) { total[i]++; if (state[r.id].inc) inc[i]++; }
  const sel = $("series"), value = sel.value;
  sel.innerHTML = '<option value="">All series (' + data.seriesNames.length + ')</option>' + seriesOrder.map((i) =>
    '<option value="' + i + '">' + esc(data.seriesNames[i]) + " (" + inc[i] + "/" + total[i] + ")</option>").join("");
  sel.value = value;
}

let shown = [], page = 0;
function filter() {
  const q = $("q").value.trim().toLowerCase(), series = $("series").value, gs = $("gs").value;
  const status = $("status").value, media = $("media").value, role = $("role").value, minfav = Number($("minfav").value) || 0;
  shown = rows.filter((r) => {
    const s = state[r.id];
    return (!q || r.text.includes(q)) && (series === "" || r.series.includes(Number(series))) && (!gs || r.gs === gs) &&
      (!status || (status === "inc" && s.inc) || (status === "exc" && !s.inc) || (status === "alpic" && r.pics[s.pick]?.s === "anilist")) &&
      (!media || r.media === media) && (!role || (role === "main") === r.main) && r.fav >= minfav;
  });
  if ($("sort").value === "name") shown.sort((a, b) => a.name.localeCompare(b.name));
  page = 0;
  render();
}

function card(r) {
  const s = state[r.id];
  const pics = r.pics.map((p, i) =>
    '<div class="pic' + (i === s.pick ? " chosen" : "") + '" data-i="' + i + '" title="' + esc(p.l + (p.w ? " (" + p.w + "×" + p.h + ")" : "")) + '">' +
    '<img loading="lazy" referrerpolicy="no-referrer" src="' + esc(p.t) + '" alt="">' +
    (p.s === "wiki" ? "wiki" + (p.h ? " " + p.h + "px" : "") : "AniList") + "</div>").join("");
  const series = r.series.map((i) => '<a data-series="' + i + '">' + esc(data.seriesNames[i]) + "</a>").join(" · ");
  return '<div class="top"><div><div class="name">' + esc(r.name) + '</div>' +
    '<div class="series">' + series + " — " + (r.main ? "main" : "supporting") + ", " + r.fav + " ♥</div>" +
    '<span class="badge ' + r.gs + '">gender: ' + label[r.gs] + "</span>" +
    '<a href="' + esc(r.al) + '" target="_blank">AniList</a>' + (r.wiki ? ' · <a href="' + esc(r.wiki) + '" target="_blank">wiki</a>' : "") +
    (r.note ? '<div class="note">' + esc(r.note) + "</div>" : "") + "</div>" +
    '<label class="toggle"><input type="checkbox"' + (s.inc ? " checked" : "") + "> include</label></div>" +
    '<div class="pics">' + (pics || "<em>no picture</em>") + "</div>";
}

function render() {
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  page = Math.min(page, pages - 1);
  const cards = $("cards");
  cards.innerHTML = "";
  for (const r of shown.slice(page * PAGE, (page + 1) * PAGE)) {
    const el = document.createElement("div");
    el.className = "card" + (state[r.id].inc ? "" : " excluded");
    el.innerHTML = card(r);
    el.querySelector("input").addEventListener("change", (e) => {
      state[r.id].inc = e.target.checked;
      el.classList.toggle("excluded", !e.target.checked);
      changed();
    });
    el.querySelectorAll(".pic").forEach((p) => p.addEventListener("click", () => {
      state[r.id].pick = Number(p.dataset.i);
      el.querySelectorAll(".pic").forEach((x) => x.classList.toggle("chosen", x === p));
      changed();
    }));
    el.querySelectorAll("[data-series]").forEach((a) => a.addEventListener("click", () => { $("series").value = a.dataset.series; filter(); }));
    cards.append(el);
  }
  $("page").textContent = "Page " + (page + 1) + " of " + pages;
  $("prev").disabled = page === 0;
  $("next").disabled = page >= pages - 1;
  $("shown").textContent = shown.length + " shown";
}

function changed() {
  save();
  $("count").textContent = rows.filter((r) => state[r.id].inc).length + " of " + rows.length;
  clearTimeout(changed.t);
  changed.t = setTimeout(fillSeries, 300);
}

function setAll(inc) {
  if (shown.length > 50 && !confirm((inc ? "Include" : "Exclude") + " all " + shown.length + " shown characters?")) return;
  for (const r of shown) state[r.id].inc = inc;
  changed();
  render();
}

const c = data.counts, p = data.pictureCounts;
$("stats").textContent = c.series.anime + " anime, " + c.series.manga + " manga · gender: AniList " + c.anilistFemale + ", ACDB " + c.acdbFemale + ", unsure " + c.unsure +
  " · picked wiki art " + p.withWikiArt + ", AniList picture " + p.anilistOnly;
for (const id of ["q", "minfav"]) $(id).addEventListener("input", () => { clearTimeout(filter.t); filter.t = setTimeout(filter, 200); });
for (const id of ["series", "gs", "status", "media", "role", "sort"]) $(id).addEventListener("change", filter);
$("incall").addEventListener("click", () => setAll(true));
$("excall").addEventListener("click", () => setAll(false));
$("prev").addEventListener("click", () => { page--; render(); scrollTo(0, 0); });
$("next").addEventListener("click", () => { page++; render(); scrollTo(0, 0); });
$("download").addEventListener("click", () => {
  const choices = rows.map((r) => {
    const s = state[r.id], pic = r.pics[s.pick];
    return { sourceId: r.id, name: r.name, include: s.inc, pictureUrl: pic?.u ?? null, pictureSource: pic?.s ?? null };
  });
  const body = { kind: "waifu-choices", version: 1, reviewedAt: new Date().toISOString(), generatedAt: data.generatedAt, choices };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(body, null, 1)], { type: "application/json" }));
  a.download = "waifu-choices.json";
  a.click();
});
$("load").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const body = JSON.parse(await file.text());
  for (const ch of body.choices || []) {
    const r = byId.get(ch.sourceId);
    if (!r) continue;
    const i = r.pics.findIndex((x) => x.u === ch.pictureUrl);
    state[r.id] = { inc: !!ch.include, pick: i >= 0 ? i : state[r.id].pick };
  }
  changed();
  filter();
});
$("reset").addEventListener("click", () => { if (confirm("Forget all choices made in this browser?")) { localStorage.removeItem(KEY); location.reload(); } });
fillSeries();
changed();
filter();
</script>
</body>
</html>
`;

const out = new URL("review.html", cacheDir);
await writeFile(out, html);
console.log(`Wrote ${out.pathname} (${rows.length} candidates, ${seriesNames.length} series)`);
