"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensurePerson, readPerson } from "@/lib/session";
import { GameError, giveUpTournament, pickWinner, startTournament, undoLastPick } from "@/server/game";

export type StartTournamentState = { error: string | null };

export async function startTournamentAction(_: StartTournamentState, form: FormData): Promise<StartTournamentState> {
  const scope = String(form.get("scope") ?? "");
  const size = Number(form.get("size"));
  // Start exactly what the player was told: rated, or unrated (never using allowance they didn't expect to spend).
  const expectRated = form.get("expectRated") === "1";
  const contestantIds = form.get("mode") === "pick" ? form.getAll("contestant").map(String) : undefined;
  let tournamentId: string;
  try {
    ({ tournamentId } = await startTournament(createAdminClient(), await ensurePerson(), {
      categoryId: scope === "all" ? null : scope,
      size,
      contestantIds,
      unrated: !expectRated,
      expectRated,
    }));
  } catch (error) {
    if (error instanceof GameError) {
      refresh();
      return { error: error.message };
    }
    throw error;
  }
  redirect(`/tournaments/${tournamentId}`);
}

/** Runs a play action, ignoring broken rules from stale screens (a repeated tap, another tab); the refresh shows the truth. */
async function play(action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    if (!(error instanceof GameError)) throw error;
  }
  refresh();
}

export async function pickWinnerAction(tournamentId: string, matchIndex: number, winnerId: string) {
  const person = await readPerson();
  if (!person) return;
  await play(() => pickWinner(createAdminClient(), person, tournamentId, winnerId, { matchIndex }));
}

export async function undoLastPickAction(tournamentId: string) {
  const person = await readPerson();
  if (!person) return;
  await play(() => undoLastPick(createAdminClient(), person, tournamentId));
}

export async function giveUpTournamentAction(tournamentId: string) {
  const person = await readPerson();
  if (!person) return;
  await play(() => giveUpTournament(createAdminClient(), person, tournamentId));
}
