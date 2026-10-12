import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { publicEnv } from "@/lib/env";
import { verifyVisitor } from "@/server/human-check";

/** Creates a category with `count` fresh contestants, so each test owns its scope. */
export async function createCategory(db: SupabaseClient, count: number) {
  const tag = randomUUID().slice(0, 8);
  const { data: contestants, error: contestantError } = await db
    .from("contestants")
    .insert(
      Array.from({ length: count }, (_, i) => ({
        name: `Test ${tag} ${i + 1}`,
        picture_512_url: "/samples/apple-512.svg",
        picture_128_url: "/samples/apple-128.svg",
      })),
    )
    .select("id");
  if (contestantError) throw contestantError;

  const { data: category, error: categoryError } = await db
    .from("categories")
    .insert({ name: `Test category ${tag}` })
    .select("id")
    .single();
  if (categoryError) throw categoryError;

  const { error } = await db
    .from("category_memberships")
    .insert(contestants.map((c) => ({ category_id: category.id, contestant_id: c.id })));
  if (error) throw error;

  return { categoryId: category.id as string, contestantIds: contestants.map((c) => c.id as string) };
}

const visitors: string[] = [];

export function newVisitor() {
  const visitorId = randomUUID();
  visitors.push(visitorId);
  return { visitorId };
}

/** The token Cloudflare's Turnstile test site keys hand the browser; the test secret accepts it. */
export const TURNSTILE_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

/** A visitor who has passed the human check, so their picks are accepted. */
export async function newVerifiedVisitor(db: SupabaseClient) {
  const visitor = newVisitor();
  await verifyVisitor(db, visitor, TURNSTILE_TEST_TOKEN);
  return visitor;
}

/** Stores one finished match directly, as if a visitor (or `playerId`) had picked it in Infinite Mode. */
export async function recordMatch(
  db: SupabaseClient,
  match: {
    winnerId: string;
    loserId: string;
    categoryId: string | null;
    playedAt?: Date;
    excluded?: boolean;
    rated?: boolean;
    playerId?: string;
  },
) {
  const { error } = await db.from("matches").insert({
    rated: match.rated ?? false,
    winner_id: match.winnerId,
    loser_id: match.loserId,
    category_id: match.categoryId,
    ...(match.playerId ? { player_id: match.playerId } : { visitor_id: newVisitor().visitorId }),
    played_at: (match.playedAt ?? new Date()).toISOString(),
    excluded: match.excluded ?? false,
  });
  if (error) throw error;
}

const users: string[] = [];

/** Creates a Google-like auth user with a real-looking name and email, as sign-in would. */
export async function newUser(db: SupabaseClient, { email }: { email?: string } = {}) {
  const tag = randomUUID().slice(0, 8);
  const { data, error } = await db.auth.admin.createUser({
    email: email ?? `test-${tag}@example.test`,
    email_confirm: true,
    user_metadata: { full_name: `Real Name ${tag}` },
  });
  if (error) throw error;
  users.push(data.user.id);
  return { userId: data.user.id, email: data.user.email!, fullName: `Real Name ${tag}` };
}

/** A display name no other test run has taken. */
export function uniqueDisplayName(prefix = "test") {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

/** A signed-in player who has chosen a display name. */
export async function newPlayer(db: SupabaseClient) {
  const { userId, email } = await newUser(db);
  const displayName = uniqueDisplayName();
  const { data, error } = await db.from("players").insert({ user_id: userId, display_name: displayName }).select("id").single();
  if (error) throw error;
  return { playerId: data.id as string, displayName, email };
}

/** A browser-side client signed in as the user with `email`, as after Google sign-in. */
export async function signedInClient(db: SupabaseClient, email: string) {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const client = createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await client.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (verified.error) throw verified.error;
  return client;
}

/** Makes a player the admin. */
export async function makeAdmin(db: SupabaseClient, playerId: string) {
  const { error } = await db.from("players").update({ is_admin: true }).eq("id", playerId);
  if (error) throw error;
}

/** Both sizes of a resized picture, as the browser would upload them: square WebPs at 512 and 128 px. */
export async function testPicture(color: string) {
  const square = (size: number) =>
    sharp({ create: { width: size, height: size, channels: 3, background: color } })
      .composite([{ input: Buffer.from(randomUUID()), raw: { width: 9, height: 4, channels: 1 }, top: 0, left: 0 }])
      .webp()
      .toBuffer()
      .then((b) => new Uint8Array(b));
  return { picture512: await square(512), picture128: await square(128) };
}

/** Removes everything the fixtures created, so the all-contestants scope doesn't keep growing. */
export async function removeTestData(db: SupabaseClient) {
  if (visitors.length) {
    await db.from("reports").delete().in("reporter_visitor_id", visitors);
    await db.from("matches").delete().in("visitor_id", visitors);
    await db.from("tournaments").delete().in("visitor_id", visitors);
    await db.from("infinite_pairs").delete().in("visitor_id", visitors);
    await db.from("signed_out_picks").delete().in("visitor_id", visitors);
    await db.from("visitor_verifications").delete().in("visitor_id", visitors);
  }
  const { data: players } = users.length ? await db.from("players").select("id").in("user_id", users) : { data: [] };
  const playerIds = (players ?? []).map((p) => p.id as string);
  if (playerIds.length) {
    await db.from("reports").delete().in("reporter_player_id", playerIds);
    await db.from("reports").delete().eq("target_type", "profile").in("target_id", playerIds);
    await db.from("matches").delete().in("player_id", playerIds);
    await db.from("tournaments").delete().in("player_id", playerIds);
  }

  await db.from("categories").delete().like("name", "Test category %");
  const { data: contestants } = await db.from("contestants").select("id").like("name", "Test %");
  const pictures = new Set<string>();
  for (const { id } of contestants ?? []) {
    const { data } = await db.rpc("delete_contestant", { p_contestant_id: id });
    for (const url of (data ?? []) as string[]) pictures.add(url.split("/pictures/").pop()!);
  }
  if (pictures.size) await db.storage.from("pictures").remove([...pictures]);

  if (playerIds.length) await db.from("players").delete().in("id", playerIds);
  for (const id of users.splice(0)) await db.auth.admin.deleteUser(id);
}
