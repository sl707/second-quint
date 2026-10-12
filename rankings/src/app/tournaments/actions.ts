"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensurePerson, readPerson } from "@/lib/session";
import { readClientIp } from "@/lib/visitor";
import { GameError, giveUpTournament, pickWinner, startTournament, undoLastPick } from "@/server/game";
import { play } from "../play";

export type StartTournamentState = { error: string | null };

export async function startTournamentAction(_: StartTournamentState, form: FormData): Promise<StartTournamentState> {
  const scope = String(form.get("scope") ?? "");
  const size = Number(form.get("size"));
  // Start exactly what the player was told: rated, or unrated (never using allowance they didn't expect to spend).
  const play = form.get("play") === "rated" ? "rated" : "unrated";
  const contestantIds = form.get("mode") === "pick" ? form.getAll("contestant").map(String) : undefined;
  let tournamentId: string;
  try {
    ({ tournamentId } = await startTournament(createAdminClient(), await ensurePerson(), {
      categoryId: scope === "all" ? null : scope,
      size,
      contestantIds,
      play,
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

/** Why the last pick wasn't taken, when the signed-out human check or rate limit refused it. */
export type PickState = { message: string | null };

export async function pickWinnerAction(_: PickState, form: FormData): Promise<PickState> {
  const person = await readPerson();
  if (!person) return { message: null };
  const tournamentId = String(form.get("tournamentId") ?? "");
  const matchIndex = Number(form.get("matchIndex"));
  const winnerId = String(form.get("winnerId") ?? "");
  const ip = await readClientIp();
  return { message: await play(() => pickWinner(createAdminClient(), person, tournamentId, winnerId, { matchIndex, ip })) };
}

/** Why the undo wasn't taken, if it wasn't. */
export type UndoState = { message: string | null };

export async function undoLastPickAction(tournamentId: string): Promise<UndoState> {
  const person = await readPerson();
  if (!person) return { message: null };
  return { message: await play(() => undoLastPick(createAdminClient(), person, tournamentId), { showRefusals: true }) };
}

export async function giveUpTournamentAction(tournamentId: string) {
  const person = await readPerson();
  if (!person) return;
  await play(() => giveUpTournament(createAdminClient(), person, tournamentId));
}
