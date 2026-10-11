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

/** Removes everything the fixtures created, so the all-contestants scope doesn't keep growing. */
export async function removeTestData(db: SupabaseClient) {
  if (visitors.length) {
    await db.from("matches").delete().in("visitor_id", visitors);
    await db.from("tournaments").delete().in("visitor_id", visitors);
  }
  await db.from("contestants").delete().like("name", "Test %");
  await db.from("categories").delete().like("name", "Test category %");
}
