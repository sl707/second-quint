import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { roundName, THIRD_PLACE_MATCH } from "@/domain/tournament/stage";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPerson } from "@/lib/session";
import { getTournament, isBanned, isSignedIn, type Tournament } from "@/server/game";
import { isVisitorVerified } from "@/server/human-check";
import { HumanCheck } from "../../human-check";
import { Button, ButtonLink, inlineLinkClass } from "../../ui/button";
import { RatedChip } from "../../ui/chip";
import { ContestantThumb } from "../../ui/contestant-image";
import { SectionTitle } from "../../ui/frame";
import { Notice } from "../../ui/plate";
import { giveUpTournamentAction } from "../actions";
import { BracketView } from "./bracket-view";
import { MatchPicker } from "./match-picker";
import { UndoButton } from "./undo-button";

export const metadata: Metadata = { title: "Tournament" };

function statusText(tournament: Tournament) {
  const left = tournament.bracket.matchesLeft;
  if (tournament.status === "given_up") return "Given up";
  if (tournament.status === "removed") return "Removed";
  if (tournament.bracket.finished) return "Finished";
  return `${left} ${left === 1 ? "match" : "matches"} left`;
}

export default async function TournamentPage({ params }: PageProps<"/tournaments/[id]">) {
  const { id } = await params;
  const person = await readPerson();
  const tournament = person ? await getTournament(createAdminClient(), person, id).catch(() => null) : null;
  if (!tournament) notFound();

  const { bracket } = tournament;
  const banned = await isBanned(createAdminClient(), person);
  const playable = tournament.status === "in_progress" && !banned;
  const needsHumanCheck = !!person && !isSignedIn(person) && !(await isVisitorVerified(createAdminClient(), person));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 pb-16">
      <header className="flex items-stretch justify-between gap-2 bg-gradient-to-r from-pink to-orange p-1.5">
        <div className="flex min-w-0 -skew-x-6 flex-col justify-center gap-0.5 bg-ink px-3 py-1.5">
          <Link href="/tournaments/new" className="skew-x-6 text-[13px] font-semibold text-zinc-200 hover:text-white">
            ← Tournaments
          </Link>
          <h1 className="skew-x-6 truncate pr-[0.15em] font-display text-2xl leading-none uppercase italic">{tournament.scopeName}</h1>
        </div>
        <div className="flex shrink-0 -skew-x-6 flex-col items-end justify-center gap-1 bg-ink px-3 py-1.5 text-right">
          <span className="skew-x-6">
            <RatedChip rated={tournament.rated} />
          </span>
          <span aria-live="polite" className="skew-x-6 font-display text-xl leading-none text-orange-bright uppercase tabular-nums">
            {statusText(tournament)}
          </span>
        </div>
      </header>

      {banned && tournament.status === "in_progress" && (
        <div className="px-4">
          <Notice tone="danger">Your account is banned, so you can&apos;t play.</Notice>
        </div>
      )}

      {playable && bracket.next && needsHumanCheck && (
        <div className="px-4">
          <HumanCheck />
        </div>
      )}

      {playable && bracket.next && !needsHumanCheck && (
        <section aria-label="Current match" className="flex flex-col gap-3">
          <h2 className="text-center font-display text-4xl text-orange-bright uppercase italic drop-shadow-[0_0_12px_var(--color-orange)]">
            {bracket.next.thirdPlace ? THIRD_PLACE_MATCH : roundName(bracket.next.round, bracket.rounds.length)}
          </h2>
          <MatchPicker
            tournamentId={tournament.id}
            matchIndex={bracket.next.index}
            contestants={bracket.next.contestantIds.map((id) => tournament.contestants[id])}
          />
        </section>
      )}

      {((!banned && tournament.canUndo) || (playable && tournament.rated)) && (
        <div className="flex flex-col items-center gap-4 px-4">
          {!banned && tournament.canUndo && <UndoButton tournamentId={tournament.id} />}
          {playable && tournament.rated && <GiveUp tournamentId={tournament.id} />}
        </div>
      )}

      {(tournament.status === "given_up" || tournament.status === "removed") && (
        <div className="px-4">
          <Notice>
            {tournament.status === "given_up"
              ? "You gave up this tournament. Its played matches still count; it has no tournament ranking."
              : "This tournament ended because one of its contestants or its category was deleted. Its other matches still count; it has no tournament ranking."}{" "}
            <Link href="/tournaments/new" className={inlineLinkClass}>
              Play another tournament
            </Link>
          </Notice>
        </div>
      )}

      {tournament.status !== "removed" && bracket.ranking && (
        <section aria-labelledby="ranking-heading" className="flex flex-col gap-3 px-4 md:px-6">
          <SectionTitle id="ranking-heading">Tournament ranking</SectionTitle>
          <ol aria-label="Tournament ranking" className="flex flex-col gap-1.5">
            {bracket.ranking.map((tier, i) => (
              <li
                key={tier.place}
                className={`flex items-center gap-3 px-3 py-2 ${i === 0 ? "border-2 border-pink bg-raised shadow-[4px_4px_0_var(--color-pink)]" : "border-l-4 border-edge bg-plate"}`}
              >
                <span className={`w-20 shrink-0 font-display text-xl uppercase italic ${i === 0 ? "text-pink-bright" : "text-orange-bright"}`}>
                  {tier.place}
                </span>
                <span className="flex flex-wrap gap-x-4 gap-y-2">
                  {tier.contestantIds.map((cid) => (
                    <span key={cid} className="flex items-center gap-2 font-semibold">
                      <ContestantThumb src={tournament.contestants[cid].picture128Url} size="sm" framed={i === 0} />
                      {tournament.contestants[cid].name}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
          <ButtonLink href="/tournaments/new" className="mt-2 self-start">
            <span aria-hidden>▶ </span>Play another tournament
          </ButtonLink>
        </section>
      )}

      <BracketView tournament={tournament} />
    </main>
  );
}

function GiveUp({ tournamentId }: { tournamentId: string }) {
  return (
    <details className="group flex flex-col items-center text-center text-sm">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 font-semibold tracking-wider text-muted uppercase select-none hover:text-white [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-xs transition group-open:rotate-90">
          ▶
        </span>
        <span>Give up</span>
      </summary>
      <form action={giveUpTournamentAction.bind(null, tournamentId)} className="mt-3 flex flex-col items-center gap-3">
        <p className="max-w-sm text-zinc-100">
          Matches you&apos;ve played still count, the tournament gets no ranking, and its reserved allowance isn&apos;t
          returned. You can then start another rated tournament.
        </p>
        <Button variant="danger">Give up this tournament</Button>
      </form>
    </details>
  );
}
