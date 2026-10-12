import "server-only";
import { refresh } from "next/cache";
import { GameError } from "@/server/game";
import { SignedOutPlayError } from "@/server/human-check";

/**
 * Runs a play action from a Server Function, ignoring broken rules from stale screens (a repeated
 * tap, another tab); the refresh shows the truth. Returns the message of a refusal the person
 * should see, else null: refusals by the signed-out human check or rate limit always, any other
 * refusal only with `showRefusals`.
 */
export async function play(action: () => Promise<unknown>, { showRefusals = false } = {}): Promise<string | null> {
  let message: string | null = null;
  try {
    await action();
  } catch (error) {
    if (!(error instanceof GameError)) throw error;
    if (showRefusals || error instanceof SignedOutPlayError) message = error.message;
  }
  refresh();
  return message;
}
