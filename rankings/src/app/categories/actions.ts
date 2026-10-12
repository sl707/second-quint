"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addContestantToCategory,
  CatalogError,
  createCategory,
  editCategory,
  findSimilarContestants,
  setCategoryCover,
  type SimilarContestant,
} from "@/server/catalog";

export type CategoryFormState = { error: string | null };

/** Creates a category, or edits one when `categoryId` is set. */
export async function saveCategoryAction(_: CategoryFormState, form: FormData): Promise<CategoryFormState> {
  const player = await readSignedInPlayer();
  if (!player) return { error: "Sign in to add to the catalog." };
  const db = createAdminClient();
  const input = { name: String(form.get("name") ?? ""), description: String(form.get("description") ?? "") };
  let categoryId = String(form.get("categoryId") ?? "");
  try {
    if (categoryId) await editCategory(db, player, categoryId, input);
    else ({ categoryId } = await createCategory(db, player, input));
  } catch (error) {
    if (error instanceof CatalogError) return { error: error.message };
    throw error;
  }
  redirect(`/categories/${categoryId}`);
}

/** Contestants with names like `query`, to add to a category. */
export async function searchContestantsAction(query: string): Promise<SimilarContestant[]> {
  return findSimilarContestants(createAdminClient(), String(query).slice(0, 80));
}

export async function addToCategoryAction(categoryId: string, contestantId: string): Promise<{ error: string | null }> {
  const player = await readSignedInPlayer();
  if (!player) return { error: "Sign in to add contestants." };
  try {
    await addContestantToCategory(createAdminClient(), player, categoryId, contestantId);
  } catch (error) {
    if (error instanceof CatalogError) return { error: error.message };
    throw error;
  }
  refresh();
  return { error: null };
}

export async function setCoverAction(categoryId: string, contestantId: string | null): Promise<void> {
  const player = await readSignedInPlayer();
  if (!player) return;
  try {
    await setCategoryCover(createAdminClient(), player, categoryId, contestantId);
  } catch (error) {
    if (!(error instanceof CatalogError)) throw error;
  }
  refresh();
}
