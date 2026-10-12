// Step 5: imports the owner's reviewed choices (waifu-choices.json, downloaded from review.html)
// into the "Waifu" category. Idempotent by contestants.source_id (`anilist:<id>`): re-runs add new
// characters, skip existing ones (following merges), and only replace their pictures with
// --replace-pictures. Pictures become top-cropped 512 and 128 px WebP squares, stored in the
// `pictures` bucket under the SHA-256 of their bytes, like uploads (src/server/catalog.ts).
//
//   node scripts/waifus/import.mjs --target local --added-by <displayName> --choices <file>
//     [--replace-pictures] [--limit N] [--dry-run]
//
// --target local reads rankings/.env.local; --target production reads NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SECRET_KEY from the environment only.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { parse as parseEnv } from "dotenv";
import sharp from "sharp";
import {
  MAX_STORED_PICTURE_BYTES,
  PICTURE_SIZES,
  STORED_PICTURE_QUALITY,
  sniffPictureType,
  topSquareCrop,
} from "../../src/domain/picture/picture.ts";
import { parseArgs, politeFetch } from "./lib.mjs";

const CATEGORY_NAME = "Waifu";
const CATEGORY_DESCRIPTION = "Anime's best girls: the heroines and fan favourites of well-loved series.";
const PICTURE_BUCKET = "pictures";
const ONE_YEAR_SECONDS = "31536000";
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_NAME_LENGTH = 80;

const args = parseArgs(process.argv.slice(2));
const usage = "Usage: node scripts/waifus/import.mjs --target local|production --added-by <displayName> --choices <file> [--replace-pictures] [--limit N] [--dry-run]";
const fail = (message) => {
  console.error(`error: ${message}`);
  process.exit(1);
};
if (!["local", "production"].includes(args.target)) fail(`--target must be local or production\n${usage}`);
if (typeof args["added-by"] !== "string") fail(`--added-by <displayName> is required\n${usage}`);
if (typeof args.choices !== "string") fail(`--choices <file> is required\n${usage}`);
const dryRun = Boolean(args["dry-run"]);
const replacePictures = Boolean(args["replace-pictures"]);
const limit = args.limit ? Number(args.limit) : Infinity;

let url, key;
if (args.target === "local") {
  const env = parseEnv(await readFile(new URL("../../.env.local", import.meta.url), "utf8").catch(() => fail("rankings/.env.local not found; run npm run db:start")));
  ({ NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = env);
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url ?? "")) fail(`.env.local doesn't point at a local Supabase: ${url}`);
} else {
  ({ NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env);
  if (!url || !key) fail("set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment for --target production");
  if (/127\.0\.0\.1|localhost/.test(url)) fail(`--target production but NEXT_PUBLIC_SUPABASE_URL is local: ${url}`);
}
if (!key) fail("no SUPABASE_SECRET_KEY");

const file = JSON.parse(await readFile(args.choices, "utf8"));
if (file.kind !== "waifu-choices" || !Array.isArray(file.choices)) fail(`${args.choices} isn't a waifu-choices file from review.html`);
const chosen = file.choices.filter((c) => c.include);
for (const c of chosen) {
  if (!/^anilist:\d+$/.test(c.sourceId ?? "")) fail(`bad sourceId in choices: ${JSON.stringify(c)}`);
  if (!c.name?.trim() || c.name.trim().length > MAX_NAME_LENGTH) fail(`bad name in choices: ${JSON.stringify(c)}`);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};

console.log(`${dryRun ? "[dry run] " : ""}importing into ${args.target} (${new URL(url).host}): ${chosen.length} included of ${file.choices.length}`);

// --- Who adds them -------------------------------------------------------------------------

const displayName = args["added-by"].normalize("NFC").trim().replace(/\s+/g, " ");
const players = check(
  await db.from("players").select("id, display_name, banned").ilike("display_name", displayName.replace(/[\\%_]/g, "\\$&")),
);
if (players.length !== 1) fail(`no player named "${displayName}" in ${args.target}`);
const player = players[0];
if (player.banned) fail(`player "${player.display_name}" is banned`);

// --- The category --------------------------------------------------------------------------

const categories = check(
  await db.from("categories").select("id, name, created_at").ilike("name", CATEGORY_NAME).order("created_at"),
);
let categoryId = categories[0]?.id ?? null;
if (categories.length > 1) console.warn(`warning: ${categories.length} categories named ${CATEGORY_NAME}; using the oldest (${categoryId})`);
if (!categoryId) {
  console.log(`creating category "${CATEGORY_NAME}"`);
  if (!dryRun) {
    categoryId = check(
      await db.from("categories").insert({ name: CATEGORY_NAME, description: CATEGORY_DESCRIPTION, created_by: player.id }).select("id").single(),
    ).id;
  }
}

// --- Pictures ------------------------------------------------------------------------------

async function download(link) {
  const res = await politeFetch(link, { gapMs: 300, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`picture download ${res.status}: ${link}`);
  if (Number(res.headers.get("content-length")) > MAX_SOURCE_BYTES) throw new Error(`picture too large: ${link}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_SOURCE_BYTES) throw new Error(`picture too large: ${link}`);
  if (!sniffPictureType(bytes)) throw new Error(`not a JPG, PNG, WebP, or GIF: ${link}`);
  return bytes;
}

/** The stored 512 and 128 px squares, cropped toward the top where faces are. */
async function resize(bytes) {
  const { data, info } = await sharp(bytes, { animated: false }).rotate().toBuffer({ resolveWithObject: true });
  const crop = topSquareCrop(info.width, info.height);
  const out = {};
  for (const size of PICTURE_SIZES) {
    let quality = Math.round(STORED_PICTURE_QUALITY * 100);
    for (;;) {
      const webp = await sharp(data)
        .extract({ left: crop.left, top: crop.top, width: crop.size, height: crop.size })
        .resize(size, size)
        .webp({ quality })
        .toBuffer();
      if (webp.length <= MAX_STORED_PICTURE_BYTES || quality <= 40) {
        out[size] = new Uint8Array(webp);
        break;
      }
      quality -= 15;
    }
  }
  return out;
}

async function storePicture(bytes) {
  const path = `${createHash("sha256").update(bytes).digest("hex")}.webp`;
  const { error } = await db.storage
    .from(PICTURE_BUCKET)
    .upload(path, bytes, { contentType: "image/webp", cacheControl: ONE_YEAR_SECONDS, upsert: false });
  if (error && !(String(error.statusCode ?? error.status) === "409" || /already exists/i.test(error.message ?? ""))) throw error;
  return db.storage.from(PICTURE_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function pictureUrls(link) {
  const sizes = await resize(await download(link));
  const [picture512, picture128] = await Promise.all([storePicture(sizes[512]), storePicture(sizes[128])]);
  return { picture_512_url: picture512, picture_128_url: picture128 };
}

/** Deletes stored pictures no contestant uses any more (as the catalog service does on edits). */
async function removeUnusedPictures(urls) {
  const marker = `/object/public/${PICTURE_BUCKET}/`;
  const paths = [];
  for (const u of new Set(urls)) {
    if (!u.includes(marker)) continue;
    const { count, error } = await db
      .from("contestants")
      .select("id", { count: "exact", head: true })
      .or(`picture_512_url.eq."${u}",picture_128_url.eq."${u}"`);
    if (error) throw error;
    if (!count) paths.push(u.slice(u.indexOf(marker) + marker.length));
  }
  if (paths.length) check(await db.storage.from(PICTURE_BUCKET).remove(paths));
}

// --- Contestants ---------------------------------------------------------------------------

const COLUMNS = "id, name, source_id, picture_512_url, picture_128_url, merged_into";
const existing = new Map();
const sourceIds = chosen.map((c) => c.sourceId);
for (let i = 0; i < sourceIds.length; i += 200) {
  for (const row of check(await db.from("contestants").select(COLUMNS).in("source_id", sourceIds.slice(i, i + 200)))) {
    existing.set(row.source_id, row);
  }
}

/** The contestant itself, or the one it was merged into. */
async function survivor(row) {
  let seen = 0;
  while (row.merged_into && seen++ < 20) row = check(await db.from("contestants").select(COLUMNS).eq("id", row.merged_into).single());
  return row;
}

async function addToCategory(contestantId) {
  if (dryRun) return;
  check(
    await db
      .from("category_memberships")
      .upsert({ category_id: categoryId, contestant_id: contestantId, added_by: player.id }, { onConflict: "category_id,contestant_id", ignoreDuplicates: true }),
  );
}

const counts = { added: 0, existing: 0, picturesReplaced: 0, failed: 0, skippedNoPicture: 0 };
const warnings = [];
let processed = 0;
for (const choice of chosen) {
  if (processed >= limit) break;
  processed++;
  const name = choice.name.trim();
  try {
    const found = existing.get(choice.sourceId);
    if (found) {
      const row = await survivor(found);
      counts.existing++;
      if (replacePictures && choice.pictureUrl) {
        if (!dryRun) {
          const pictures = await pictureUrls(choice.pictureUrl);
          check(await db.from("contestants").update(pictures).eq("id", row.id));
          await removeUnusedPictures([row.picture_512_url, row.picture_128_url]);
        }
        counts.picturesReplaced++;
      }
      await addToCategory(row.id);
      continue;
    }
    if (!choice.pictureUrl) {
      counts.skippedNoPicture++;
      warnings.push(`${name}: no picture chosen, skipped`);
      continue;
    }
    const similar = check(await db.rpc("similar_contestants", { p_name: name, p_limit: 3 }));
    if (similar.length) warnings.push(`${name}: looks like existing ${similar.map((s) => `"${s.name}" (${s.id})`).join(", ")}; merge on /admin if it's the same character`);
    if (dryRun) {
      counts.added++;
      continue;
    }
    const pictures = await pictureUrls(choice.pictureUrl);
    const inserted = await db
      .from("contestants")
      .insert({ name, ...pictures, created_by: player.id, source_id: choice.sourceId })
      .select("id")
      .single();
    let id = inserted.data?.id;
    if (inserted.error?.code === "23505") {
      // Added by a run in parallel: use that one.
      id = (await survivor(check(await db.from("contestants").select(COLUMNS).eq("source_id", choice.sourceId).single()))).id;
      await removeUnusedPictures([pictures.picture_512_url, pictures.picture_128_url]);
      counts.existing++;
    } else {
      check(inserted);
      counts.added++;
    }
    await addToCategory(id);
  } catch (error) {
    counts.failed++;
    warnings.push(`${name} (${choice.sourceId}): FAILED ${error.message ?? error}`);
  }
  if (processed % 25 === 0) console.log(`  ${processed}/${Math.min(chosen.length, limit)}`);
}

for (const w of warnings) console.warn(`- ${w}`);
console.log(`${dryRun ? "[dry run] " : ""}done: ${JSON.stringify(counts)}`);
if (counts.failed) process.exit(1);
