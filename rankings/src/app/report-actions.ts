"use server";

import { ensurePerson } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { CatalogError, reportItem, type ReportTargetType } from "@/server/catalog";

export type ReportFormState = { error: string | null; sent: boolean };

const TARGET_TYPES: ReportTargetType[] = ["contestant", "category", "profile"];

/** Sends the admin a report about a contestant, category, or profile; anyone may. */
export async function reportAction(
  targetType: ReportTargetType,
  targetId: string,
  _: ReportFormState,
  form: FormData,
): Promise<ReportFormState> {
  if (!TARGET_TYPES.includes(targetType)) return { error: "That can't be reported.", sent: false };
  const person = await ensurePerson();
  try {
    await reportItem(createAdminClient(), person, { type: targetType, id: String(targetId) }, String(form.get("reason") ?? ""));
  } catch (error) {
    if (error instanceof CatalogError) return { error: error.message, sent: false };
    throw error;
  }
  return { error: null, sent: true };
}
