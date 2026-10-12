"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensurePerson, readPerson } from "@/lib/session";
import { GameError, pickInfiniteWinner, skipInfinitePair } from "@/server/game";

/** Gives a signed-out browser its visitor ID, then opens Infinite Mode on the scope ("all" or a category ID). */
export async function startInfiniteModeAction(scope: string) {
  await ensurePerson();
  redirect(`/infinite/${encodeURIComponent(scope)}`);
}

/** What happened to the last pair, and how many picks this visit to the page. */
export type InfinitePlayState = { message: string | null; picks: number };

/** Picks the winner from the offered pair, or skips it when the form has no winner. */
export async function playInfiniteAction(state: InfinitePlayState, form: FormData): Promise<InfinitePlayState> {
  const person = await readPerson();
  if (!person) return state;
  const pairId = String(form.get("pairId") ?? "");
  const winnerId = form.get("winnerId");
  let next: InfinitePlayState;
  try {
    if (winnerId === null) {
      await skipInfinitePair(createAdminClient(), person, { pairId });
      next = { message: "Skipped.", picks: state.picks };
    } else {
      await pickInfiniteWinner(createAdminClient(), person, { pairId, winnerId: String(winnerId) });
      next = { message: `You picked ${form.get("winnerName")} over ${form.get("loserName")}.`, picks: state.picks + 1 };
    }
  } catch (error) {
    // A repeated tap or another tab; the refresh shows the pair that's actually offered.
    if (!(error instanceof GameError)) throw error;
    next = { message: null, picks: state.picks };
  }
  refresh();
  return next;
}
