"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/pathname";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createVisitorClient } from "@/lib/supabase/server";
import { deleteAccount, ProfileError } from "@/server/profiles";

/** Sends the browser to Google; it comes back through /auth/callback. */
export async function signInWithGoogleAction(form: FormData) {
  const next = safeNextPath(String(form.get("next") ?? "/"));
  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ??
    `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("host")}`;

  const { data, error } = await (await createVisitorClient()).auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) throw error;
  redirect(data.url);
}

export type DeleteAccountState = { error: string | null };

/** Deletes the signed-in player's account once they've typed their display name, then signs them out. */
export async function deleteAccountAction(_: DeleteAccountState, form: FormData): Promise<DeleteAccountState> {
  const session = await getSession();
  if (session.status !== "player") redirect("/");
  const { player } = session;
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== player.displayName.toLowerCase()) {
    return { error: `Type ${player.displayName} to confirm.` };
  }

  try {
    await deleteAccount(createAdminClient(), { playerId: player.id });
  } catch (error) {
    if (error instanceof ProfileError) return { error: error.message };
    throw error;
  }
  // The auth user is gone, so only the session cookies are left to clear.
  await (await createVisitorClient()).auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOutAction() {
  await (await createVisitorClient()).auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
