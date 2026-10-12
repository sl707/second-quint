import { randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** Full-access client for arranging and checking test data. */
export const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Stands in for Google sign-in: creates an auth user with a real-looking name and email, starts a
 * session for them with an admin-issued magic link, and gives the browser the same session cookies
 * the app's sign-in callback would set.
 */
export async function signInAsNewUser(context: BrowserContext, baseURL: string) {
  const tag = randomUUID().slice(0, 8);
  const email = `e2e-${tag}@example.test`;
  const fullName = `Real Name ${tag}`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError) throw linkError;

  const jar = new Map<string, string>();
  const server = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (toSet) => {
        for (const { name, value } of toSet) jar.set(name, value);
      },
    },
  });
  const { error: verifyError } = await server.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (verifyError) throw verifyError;

  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: baseURL })));
  return { userId: created.user.id, email, fullName };
}

/** Deletes a test user along with their player, tournaments, and matches. */
export async function deleteUser(userId: string) {
  const { data: player } = await admin.from("players").select("id").eq("user_id", userId).maybeSingle();
  if (player) {
    await admin.from("matches").delete().eq("player_id", player.id);
    await admin.from("tournaments").delete().eq("player_id", player.id);
    await admin.from("players").delete().eq("id", player.id);
  }
  await admin.auth.admin.deleteUser(userId);
}
