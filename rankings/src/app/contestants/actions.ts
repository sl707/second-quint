"use server";

import { redirect } from "next/navigation";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addContestant,
  addContestantToCategory,
  CatalogError,
  deleteContestant,
  editContestant,
  findSimilarContestants,
  type SimilarContestant,
} from "@/server/catalog";

export type ContestantFormState = { error: string | null };

async function readPicture(form: FormData, field: string): Promise<Uint8Array | undefined> {
  const file = form.get(field);
  return file instanceof Blob && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : undefined;
}

/** Adds a contestant (optionally straight into a category), or edits one when `contestantId` is set. */
export async function saveContestantAction(_: ContestantFormState, form: FormData): Promise<ContestantFormState> {
  const player = await readSignedInPlayer();
  if (!player) return { error: "Sign in to add to the catalog." };
  const db = createAdminClient();
  const contestantId = String(form.get("contestantId") ?? "");
  const categoryId = String(form.get("categoryId") ?? "");
  const name = String(form.get("name") ?? "");
  const [picture512, picture128] = await Promise.all([readPicture(form, "picture512"), readPicture(form, "picture128")]);

  let destination: string;
  try {
    if (contestantId) {
      await editContestant(db, player, contestantId, { name, picture512, picture128 });
      destination = `/contestants/${contestantId}`;
    } else {
      if (!picture512 || !picture128) return { error: "Choose a picture." };
      const contestant = await addContestant(db, player, { name, picture512, picture128 });
      if (categoryId) await addContestantToCategory(db, player, categoryId, contestant.id);
      destination = categoryId ? `/categories/${categoryId}` : `/contestants/${contestant.id}`;
    }
  } catch (error) {
    if (error instanceof CatalogError) return { error: error.message };
    throw error;
  }
  redirect(destination);
}

/** Existing contestants with names like `name`, for "Did you mean…?". */
export async function findSimilarContestantsAction(name: string): Promise<SimilarContestant[]> {
  return findSimilarContestants(createAdminClient(), String(name).slice(0, 80));
}

export async function deleteContestantAction(contestantId: string): Promise<void> {
  const player = await readSignedInPlayer();
  if (!player) return;
  try {
    await deleteContestant(createAdminClient(), player, contestantId);
  } catch (error) {
    if (error instanceof CatalogError) redirect(`/contestants/${contestantId}`);
    throw error;
  }
  redirect("/categories");
}
