"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AdminError,
  banPlayer,
  closeReport,
  deleteCategory,
  mergeContestants,
  removeContestantFromCategory,
  renamePlayer,
  unbanPlayer,
} from "@/server/admin";

async function asAdmin(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (!(error instanceof AdminError)) throw error;
  }
  refresh();
}

export async function closeReportAction(reportId: number, outcome: "resolved" | "dismissed"): Promise<void> {
  const player = await readSignedInPlayer();
  await asAdmin(() => closeReport(createAdminClient(), player, Number(reportId), outcome === "resolved" ? "resolved" : "dismissed"));
}

export async function removeFromCategoryAction(categoryId: string, contestantId: string): Promise<void> {
  const player = await readSignedInPlayer();
  await asAdmin(() => removeContestantFromCategory(createAdminClient(), player, String(categoryId), String(contestantId)));
}

export async function mergeContestantsAction(duplicateId: string, survivorId: string): Promise<void> {
  const player = await readSignedInPlayer();
  try {
    await mergeContestants(createAdminClient(), player, String(duplicateId), String(survivorId));
  } catch (error) {
    if (error instanceof AdminError) redirect("/admin");
    throw error;
  }
  redirect(`/contestants/${survivorId}`);
}

export type RenamePlayerState = { error: string | null };

export async function renamePlayerAction(playerId: string, _: RenamePlayerState, form: FormData): Promise<RenamePlayerState> {
  const player = await readSignedInPlayer();
  let displayName: string;
  try {
    displayName = await renamePlayer(createAdminClient(), player, String(playerId), String(form.get("displayName") ?? ""));
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    throw error;
  }
  redirect(`/players/${encodeURIComponent(displayName)}`);
}

export async function banPlayerAction(playerId: string, form: FormData): Promise<void> {
  const player = await readSignedInPlayer();
  const removeMatches = form.get("removeMatches") !== null;
  await asAdmin(() => banPlayer(createAdminClient(), player, String(playerId), { removeMatches }));
}

export async function unbanPlayerAction(playerId: string): Promise<void> {
  const player = await readSignedInPlayer();
  await asAdmin(() => unbanPlayer(createAdminClient(), player, String(playerId)));
}

export async function deleteCategoryAction(categoryId: string): Promise<void> {
  const player = await readSignedInPlayer();
  try {
    await deleteCategory(createAdminClient(), player, String(categoryId));
  } catch (error) {
    if (error instanceof AdminError) redirect(`/categories/${categoryId}`);
    throw error;
  }
  redirect("/categories");
}
