"use server";

import { refresh } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { readClientIp, readVisitor } from "@/lib/visitor";
import { SignedOutPlayError, verifyVisitor } from "@/server/human-check";

/** Checks the browser's Turnstile token for its signed-out visitor; on success the page shows play again. */
export async function verifyVisitorAction(token: string): Promise<{ error: string | null }> {
  const visitor = await readVisitor();
  if (!visitor) return { error: "Start playing first, then confirm you're human." };
  try {
    await verifyVisitor(createAdminClient(), visitor, String(token), { ip: await readClientIp() });
  } catch (error) {
    if (error instanceof SignedOutPlayError) return { error: error.message };
    throw error;
  }
  refresh();
  return { error: null };
}
