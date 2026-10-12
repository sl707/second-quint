import type { SupabaseClient } from "@supabase/supabase-js";
import type { Visitor } from "@/server/game";
import { GameError } from "@/server/game-error";

/** How long a passed human check lets a signed-out visitor keep picking. */
export const HUMAN_CHECK_HOURS = 24;

/** Signed-out picks allowed per minute, per visitor and per IP. */
export const SIGNED_OUT_PICKS_PER_MINUTE = 30;

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const HUMAN_CHECK_NOT_SET_UP = "Signed-out play is paused because the human check isn't set up. Sign in to play.";
const FAILED = "We couldn't confirm you're human. Try again, or sign in to play.";
const UNVERIFIED = "Confirm you're human before picking, or sign in to play.";
const TOO_FAST = `Slow down! That's more than ${SIGNED_OUT_PICKS_PER_MINUTE} picks in a minute. Take a breather, then pick again.`;

/** Signed-out play was refused by the human check or the rate limit; the message is safe to show. */
export class SignedOutPlayError extends GameError {}

/**
 * Checks the visitor's Cloudflare Turnstile token and, if it passes, lets their picks through for
 * `HUMAN_CHECK_HOURS`. Without `TURNSTILE_SECRET_KEY` nobody passes.
 */
export async function verifyVisitor(
  db: SupabaseClient,
  visitor: Visitor,
  token: string,
  { ip = null, now = new Date() }: { ip?: string | null; now?: Date } = {},
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new SignedOutPlayError(HUMAN_CHECK_NOT_SET_UP);
  if (!token) throw new SignedOutPlayError(FAILED);

  let passed = false;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    passed = response.ok && ((await response.json()) as { success?: unknown }).success === true;
  } catch {
    passed = false;
  }
  if (!passed) throw new SignedOutPlayError(FAILED);

  const verifiedUntil = new Date(now.getTime() + HUMAN_CHECK_HOURS * 60 * 60 * 1000);
  const { error } = await db
    .from("visitor_verifications")
    .upsert({ visitor_id: visitor.visitorId, verified_until: verifiedUntil.toISOString() });
  if (error) throw error;
  const pruned = await db.from("visitor_verifications").delete().lte("verified_until", now.toISOString());
  if (pruned.error) throw pruned.error;
}

/** Whether the visitor has a passed human check that hasn't expired. */
export async function isVisitorVerified(
  db: SupabaseClient,
  visitor: Visitor,
  { now = new Date() }: { now?: Date } = {},
): Promise<boolean> {
  const { count, error } = await db
    .from("visitor_verifications")
    .select("visitor_id", { count: "exact", head: true })
    .eq("visitor_id", visitor.visitorId)
    .gt("verified_until", now.toISOString());
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Lets one signed-out pick through, or throws a `SignedOutPlayError` saying why not. */
export async function claimSignedOutPick(
  db: SupabaseClient,
  visitor: Visitor,
  { ip = null, now = new Date() }: { ip?: string | null; now?: Date } = {},
): Promise<void> {
  const { data, error } = await db.rpc("claim_signed_out_pick", {
    p_visitor_id: visitor.visitorId,
    p_ip: ip,
    p_now: now.toISOString(),
    p_limit: SIGNED_OUT_PICKS_PER_MINUTE,
    p_window: "1 minute",
  });
  if (error) throw error;
  if (data === "unverified") throw new SignedOutPlayError(UNVERIFIED);
  if (data === "too-fast") throw new SignedOutPlayError(TOO_FAST);
}
