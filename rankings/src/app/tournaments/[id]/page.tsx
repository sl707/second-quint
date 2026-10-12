import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { roundName, THIRD_PLACE_MATCH } from "@/domain/tournament/stage";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPerson } from "@/lib/session";
import { getTournament, isBanned, isSignedIn, type ContestantCard } from "@/server/game";
import { isVisitorVerified } from "@/server/human-check";
import { HumanCheck } from "../../human-check";
import { giveUpTournamentAction, undoLastPickAction } from "../actions";
import { BracketView } from "./bracket-view";
import { MatchPicker } from "./match-picker";

export const metadata: Metadata = { title: "Tournament" };

export default async function TournamentPage({ params }: PageProps<"/tournaments/[id]">) {
  const { id } = await params;
  const person = await readPerson();
  const tournament = person ? await getTournament(createAdminClient(), person, id).catch(() => null) : null;
  if (!tournament) notFound();

  const { bracket } = tournament;
  const left = bracket.matchesLeft;
  const banned = await isBanned(createAdminClient(), person);
  const playable = tournament.status === "in_progress" && !banned;
  const needsHumanCheck = !!person && !isSignedIn(person) && !(await isVisitorVerified(createAdminClient(), person));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-5 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <Link href="/tournaments/new" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Tournaments
          </Link>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{tournament.scopeName}</h1>
        </div>
        <p className="text-sm text-zinc-600">
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-700">
            {tournament.rated ? "Rated" : "Unrated"}
          </span>{" "}
          <span aria-live="polite">
            {tournament.status === "given_up"
              ? "Given up"
              : tournament.status === "removed"
                ? "Removed"
                : bracket.finished
                ? "Finished"
                : `${left} ${left === 1 ? "match" : "matches"} left`}
          </span>
        </p>
      </header>

      {banned && tournament.status === "in_progress" && (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-zinc-700">Your account is banned, so you can&apos;t play.</p>
      )}

      {playable && bracket.next && needsHumanCheck && <HumanCheck />}

      {playable && bracket.next && !needsHumanCheck && (
        <section aria-label="Current match" className="flex flex-col gap-3">
          <h2 className="text-center text-sm font-medium uppercase tracking-wide text-zinc-500">
            {bracket.next.thirdPlace ? THIRD_PLACE_MATCH : roundName(bracket.next.round, bracket.rounds.length)}
          </h2>
          <MatchPicker
            tournamentId={tournament.id}
            matchIndex={bracket.next.index}
            contestants={bracket.next.contestantIds.map((id) => tournament.contestants[id])}
          />
        </section>
      )}

      {playable && tournament.canUndo && (
        <form action={undoLastPickAction.bind(null, tournament.id)} className="flex justify-center">
          <button
            type="submit"
            className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500"
          >
            Undo
          </button>
        </form>
      )}

      {playable && tournament.rated && <GiveUp tournamentId={tournament.id} />}

      {tournament.status === "given_up" && (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-zinc-700">
          You gave up this tournament. Its played matches still count; it has no tournament ranking.{" "}
          <Link href="/tournaments/new" className="font-medium underline">
            Play another tournament
          </Link>
        </p>
      )}

      {tournament.status === "removed" && (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-zinc-700">
          This tournament ended because one of its contestants or its category was deleted. Its other matches still
          count; it has no tournament ranking.{" "}
          <Link href="/tournaments/new" className="font-medium underline">
            Play another tournament
          </Link>
        </p>
      )}

      {tournament.status !== "removed" && bracket.ranking && (
        <section aria-labelledby="ranking-heading" className="flex flex-col gap-3">
          <h2 id="ranking-heading" className="text-xl font-semibold tracking-tight">
            Tournament ranking
          </h2>
          <ol aria-label="Tournament ranking" className="flex flex-col gap-2">
            {bracket.ranking.map((tier) => (
              <li key={tier.place} className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3">
                <span className="w-20 shrink-0 pt-1 font-semibold">{tier.place}</span>
                <span className="flex flex-wrap gap-x-4 gap-y-2">
                  {tier.contestantIds.map((cid) => (
                    <ContestantChip key={cid} contestant={tournament.contestants[cid]} />
                  ))}
                </span>
              </li>
            ))}
          </ol>
          <Link
            href="/tournaments/new"
            className="self-start rounded-xl bg-zinc-900 px-4 py-3 font-medium text-white"
          >
            Play another tournament
          </Link>
        </section>
      )}

      <BracketView tournament={tournament} />
    </main>
  );
}

function GiveUp({ tournamentId }: { tournamentId: string }) {
  return (
    <details className="self-center text-center text-sm text-zinc-600">
      <summary className="cursor-pointer select-none">Give up</summary>
      <form action={giveUpTournamentAction.bind(null, tournamentId)} className="mt-2 flex flex-col items-center gap-2">
        <p className="max-w-sm">
          Matches you&apos;ve played still count, the tournament gets no ranking, and its reserved allowance isn&apos;t
          returned. You can then start another rated tournament.
        </p>
        <button
          type="submit"
          className="rounded-full border border-red-300 bg-white px-5 py-2 font-medium text-red-700 hover:border-red-500"
        >
          Give up this tournament
        </button>
      </form>
    </details>
  );
}

function ContestantChip({ contestant }: { contestant: ContestantCard }) {
  return (
    <span className="flex items-center gap-2">
      <Image src={contestant.picture128Url} alt="" width={128} height={128} className="size-8 rounded-md object-cover" />
      <span>{contestant.name}</span>
    </span>
  );
}
