// Shared helpers for the waifu import scripts: the cache directory, polite throttled fetches, and
// a response cache so re-runs never ask a site the same question twice.
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";

export const cacheDir = new URL("../../.cache/waifus/", import.meta.url);
/** SUPPORTING characters need at least this many AniList favourites; every MAIN character counts. */
export const MIN_SUPPORTING_FAVOURITES = 1;
export const userAgent =
  "SecondQuintRankings-WaifuImport/1.0 (+https://rankings.secondquint.com; one-off catalog import, cached)";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const exists = (url) => access(url).then(() => true, () => false);
export const readJson = async (url) => JSON.parse(await readFile(url, "utf8"));
export async function writeJson(url, value) {
  await mkdir(new URL(".", url), { recursive: true });
  await writeFile(url, JSON.stringify(value, null, 1));
}

const lastRequest = new Map();

/** Waits until `gapMs` has passed since the last request in `bucket`. */
async function throttle(bucket, gapMs) {
  const wait = (lastRequest.get(bucket) ?? 0) + gapMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest.set(bucket, Date.now());
}

/** fetch with our User-Agent, a per-bucket gap between requests, and retries on 429/5xx. */
export async function politeFetch(url, { bucket, gapMs, headers, attempt = 1, ...init } = {}) {
  await throttle(bucket ?? new URL(url).host, gapMs ?? 1000);
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(30_000), ...init, headers: { "User-Agent": userAgent, ...headers } });
  } catch (error) {
    if (attempt > 4) throw error;
    await sleep(3000 * attempt);
    return politeFetch(url, { bucket, gapMs, headers, attempt: attempt + 1, ...init });
  }
  if ((res.status === 429 || res.status >= 500) && res.status !== 503 && attempt <= 5) {
    const retryAfter = Number(res.headers.get("retry-after")) || 5 * attempt;
    await sleep(retryAfter * 1000);
    return politeFetch(url, { bucket, gapMs, headers, attempt: attempt + 1, ...init });
  }
  return res;
}

const keyOf = (url) => createHash("sha256").update(url).digest("hex").slice(0, 32);

/**
 * A JSON GET answered from `.cache/waifus/<dir>/` when asked before. `load(url)` does the request
 * and returns the value to cache (null is cached too, meaning "nothing there").
 */
export async function cachedJson(dir, url, load) {
  const file = new URL(`${dir}/${keyOf(url)}.json`, cacheDir);
  if (await exists(file)) return (await readJson(file)).value;
  const value = await load(url);
  await writeJson(file, { url, value });
  return value;
}

/** Lowercase letters and digits only, accents removed: for comparing names and titles. */
export function simplify(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Whether two person names are the same, in either name order. */
export function sameName(a, b) {
  const x = simplify(a).split(" ").filter(Boolean).sort().join(" ");
  const y = simplify(b).split(" ").filter(Boolean).sort().join(" ");
  return x.length > 0 && x === y;
}

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) args._.push(a);
    else if (a.includes("=")) args[a.slice(2, a.indexOf("="))] = a.slice(a.indexOf("=") + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) args[a.slice(2)] = argv[++i];
    else args[a.slice(2)] = true;
  }
  return args;
}
