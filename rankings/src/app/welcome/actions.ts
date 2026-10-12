"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/pathname";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { chooseDisplayName, ProfileError } from "@/server/profiles";

export type ChooseDisplayNameState = { error: string | null };

export async function chooseDisplayNameAction(
  _: ChooseDisplayNameState,
  form: FormData,
): Promise<ChooseDisplayNameState> {
  const next = safeNextPath(String(form.get("next") ?? "/"));
  const session = await getSession();
  if (session.status === "signed-out") redirect("/");
  if (session.status === "needs-display-name") {
    try {
      await chooseDisplayName(createAdminClient(), session.userId, String(form.get("displayName") ?? ""));
    } catch (error) {
      if (error instanceof ProfileError) return { error: error.message };
      throw error;
    }
  }
  revalidatePath("/", "layout");
  redirect(next);
}
