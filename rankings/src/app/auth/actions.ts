"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/pathname";
import { createVisitorClient } from "@/lib/supabase/server";

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

export async function signOutAction() {
  await (await createVisitorClient()).auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
