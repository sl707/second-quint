import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPerson } from "@/lib/session";
import { getTournament, type ContestantCard, type Tournament } from "@/server/game";
import { giveUpTournamentAction, pickWinnerAction, undoLastPickAction } from "../actions";
import { BracketView, roundName } from "./bracket-view";

export const metadata: Metadata = { title: "Tournament" };

export default async function TournamentPage({ params }: PageProps<"/tournaments/[id]">) {
  const { id } = await params;
  const person = await readPerson();
  const tournament = person ? await getTournament(createAdminClient(), person, id).catch(() => null) : null;
  if (!tournament) notFound();

  const { bracket } = tournament;
  const left = bracket.matchesLeft;
  const inProgress = tournament.status === "in_progress";

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

      {inProgress && bracket.next && (
        <section aria-label="Current match" className="flex flex-col gap-3">
          <h2 className="text-center text-sm font-medium uppercase tracking-wide text-zinc-500">
            {bracket.next.thirdPlace ? "Third-place match" : roundName(bracket.next.round, bracket.rounds.length)}
          </h2>
          <div className="flex flex-col items-stretch gap-2 md:flex-row md:gap-6">
            {bracket.next.contestantIds.map((contestantId, i) => (
              <div key={contestantId} className="contents">
                {i === 1 && (
                  <span className="self-center text-xs font-semibold uppercase text-zinc-400" aria-hidden>
                    vs
                  </span>
                )}
                <PickButton
                  tournament={tournament}
                  matchIndex={bracket.next!.index}
                  contestant={tournament.contestants[contestantId]}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {inProgress && tournament.canUndo && (
        <form action={undoLastPickAction.bind(null, tournament.id)} className="flex justify-center">
          <button
            type="submit"
            className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500"
          >
            Undo
          </button>
        </form>
      )}

      {inProgress && tournament.rated && <GiveUp tournamentId={tournament.id} />}

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

function PickButton({
  tournament,
  matchIndex,
  contestant,
}: {
  tournament: Tournament;
  matchIndex: number;
  contestant: ContestantCard;
}) {
  return (
    <form action={pickWinnerAction.bind(null, tournament.id, matchIndex, contestant.id)} className="flex-1">
      <button
        type="submit"
        aria-label={`Pick ${contestant.name}`}
        className="group flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-3 text-left shadow-sm transition hover:border-zinc-900 active:scale-[0.99] md:flex-col md:items-center md:p-4 md:text-center"
      >
        <Image
          src={contestant.picture512Url}
          alt=""
          width={512}
          height={512}
          priority
          className="aspect-square w-28 shrink-0 rounded-xl object-cover sm:w-36 md:w-full md:max-w-72"
        />
        <span className="text-lg font-semibold md:text-xl">{contestant.name}</span>
      </button>
    </form>
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
