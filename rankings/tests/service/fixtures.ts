import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Stores one finished match directly, as if a visitor had picked it in Infinite Mode. */
export async function recordMatch(
  db: SupabaseClient,
  match: { winnerId: string; loserId: string; categoryId: string | null; playedAt?: Date; excluded?: boolean },
) {
  const { error } = await db.from("matches").insert({
    winner_id: match.winnerId,
    loser_id: match.loserId,
    category_id: match.categoryId,
    visitor_id: newVisitor().visitorId,
    played_at: (match.playedAt ?? new Date()).toISOString(),
    excluded: match.excluded ?? false,
  });
  if (error) throw error;
}

const users: string[] = [];

/** Creates a Google-like auth user with a real-looking name and email, as sign-in would. */
export async function newUser(db: SupabaseClient) {
  const tag = randomUUID().slice(0, 8);
  const { data, error } = await db.auth.admin.createUser({
    email: `test-${tag}@example.test`,
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

/** Removes everything the fixtures created, so the all-contestants scope doesn't keep growing. */
export async function removeTestData(db: SupabaseClient) {
  if (visitors.length) {
    await db.from("matches").delete().in("visitor_id", visitors);
    await db.from("tournaments").delete().in("visitor_id", visitors);
  }
  if (users.length) {
    const { data: players } = await db.from("players").select("id").in("user_id", users);
    const playerIds = (players ?? []).map((p) => p.id as string);
    if (playerIds.length) {
      await db.from("matches").delete().in("player_id", playerIds);
      await db.from("tournaments").delete().in("player_id", playerIds);
      await db.from("players").delete().in("id", playerIds);
    }
    for (const id of users.splice(0)) await db.auth.admin.deleteUser(id);
  }
  await db.from("contestants").delete().like("name", "Test %");
  await db.from("categories").delete().like("name", "Test category %");
}
