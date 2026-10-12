"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminError, closeReport, deleteCategory, removeContestantFromCategory } from "@/server/admin";

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
