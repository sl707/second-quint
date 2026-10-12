"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensurePerson, readPerson } from "@/lib/session";
import { readClientIp } from "@/lib/visitor";
import { isSignedIn, pickInfiniteWinner, skipInfinitePair } from "@/server/game";
import { play } from "../play";

/**
 * Gives a signed-out browser its visitor ID, then opens Infinite Mode on the form's scope ("all" or
 * a category ID), unrated if a signed-in player ticked "Play unrated".
 */
export async function startInfiniteModeAction(form: FormData) {
  const person = await ensurePerson();
  const scope = encodeURIComponent(String(form.get("scope") ?? "all"));
  const unrated = isSignedIn(person) && form.get("unrated") !== null;
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
  let next: InfinitePlayState = { message: null, picks: state.picks };
  // A skip is refused when the rated skips are used up, which the player needs to be told.
  const refusal = await play(
    async () => {
      if (winnerId === null) {
        await skipInfinitePair(createAdminClient(), person, { pairId });
        next = { message: "Skipped.", picks: state.picks };
        return;
      }
      const { rated } = await pickInfiniteWinner(
        createAdminClient(),
        person,
        { pairId, winnerId: String(winnerId) },
        { ip: await readClientIp() },
      );
      const lastRated =
        rated && form.get("lastRatedPick") !== null
          ? " That was your last rated pick in this scope today; your picks are unrated until midnight Eastern."
          : "";
      next = {
        message: `You picked ${form.get("winnerName")} over ${form.get("loserName")}.${lastRated}`,
        picks: state.picks + 1,
      };
    },
    { showRefusals: winnerId === null },
  );
  return refusal === null ? next : { message: refusal, picks: state.picks };
}
