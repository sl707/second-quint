"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensurePerson, readPerson } from "@/lib/session";
import { GameError, pickInfiniteWinner, skipInfinitePair } from "@/server/game";

/**
 * Gives a signed-out browser its visitor ID, then opens Infinite Mode on the form's scope ("all" or
 * a category ID), unrated if a signed-in player ticked "Play unrated".
 */
export async function startInfiniteModeAction(form: FormData) {
  const person = await ensurePerson();
  const scope = encodeURIComponent(String(form.get("scope") ?? "all"));
  const unrated = "playerId" in person && form.get("unrated") !== null;
  redirect(`/infinite/${scope}${unrated ? "?play=unrated" : ""}`);
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
      const { rated } = await pickInfiniteWinner(createAdminClient(), person, { pairId, winnerId: String(winnerId) });
      const lastRated =
        rated && form.get("lastRatedPick") !== null
          ? " That was your last rated pick in this scope today; your picks are unrated until midnight Eastern."
          : "";
      next = {
        message: `You picked ${form.get("winnerName")} over ${form.get("loserName")}.${lastRated}`,
        picks: state.picks + 1,
      };
    }
  } catch (error) {
    if (!(error instanceof GameError)) throw error;
    // A repeated tap or another tab; the refresh shows the pair that's actually offered. A skip can
    // also be refused when the rated skips are used up.
    next = { message: winnerId === null ? error.message : null, picks: state.picks };
  }
  refresh();
  return next;
}
