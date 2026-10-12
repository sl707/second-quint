import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createVisitorClient } from "@/lib/supabase/server";
import { findMergeSurvivor, getContestant } from "@/server/catalog";
import { getContestantRankings, type ContestantScopeRanking } from "@/server/rankings";
import { AddedBy } from "../../added-by";
import { ReportForm } from "../../report-form";
import { isRatedVersion, VersionSwitch } from "../../rankings/ranking-view";
import { Button } from "../../ui/button";
import { ContestantPortrait, ContestantThumb } from "../../ui/contestant-image";
import { eyebrowClass, Page, SectionTitle } from "../../ui/frame";
import { Disclosure, Notice, plateClass } from "../../ui/plate";
import { deleteContestantAction } from "../actions";
import { ContestantForm } from "../contestant-form";
import { RatingChart } from "./rating-chart";

const loadContestant = cache(async (id: string) => getContestant(createAdminClient(), id, await readSignedInPlayer()));

export async function generateMetadata({ params }: PageProps<"/contestants/[id]">): Promise<Metadata> {
  return { title: (await loadContestant((await params).id))?.name ?? "Contestant not found" };
}

/** `?version=unrated` shows the Unrated Rankings and every match; without it, rated only. */
export default async function ContestantPage({ params, searchParams }: PageProps<"/contestants/[id]">) {
  const { id } = await params;
  const contestant = await loadContestant(id);
  const rated = isRatedVersion(await searchParams);
  if (!contestant) {
    const survivorId = await findMergeSurvivor(createAdminClient(), id);
    if (survivorId) permanentRedirect(`/contestants/${survivorId}${rated ? "" : "?version=unrated"}`);
    notFound();
  }
  const rankings = (await getContestantRankings(await createVisitorClient(), contestant.id, { rated }))!;
  const path = `/contestants/${contestant.id}`;

  return (
    <Page>
      <header className="flex flex-col gap-3">
        <ContestantPortrait
          src={contestant.picture512Url}
          alt={contestant.name}
          priority
          className="w-full max-w-sm self-center shadow-[8px_8px_0_var(--color-pink)]"
          caption={
            <div className="flex flex-col gap-1">
              <p className={eyebrowClass}>Contestant</p>
              <h1 className="font-display text-4xl leading-none uppercase italic [overflow-wrap:anywhere] md:text-5xl">{contestant.name}</h1>
              <AddedBy by={contestant.createdBy} />
            </div>
          }
        />
      </header>

      <VersionSwitch rated={rated} ratedHref={path} unratedHref={`${path}?version=unrated`} />

      <section aria-labelledby="record-heading" className={plateClass("accent", "flex items-end justify-between gap-3 px-4 py-3")}>
        <div className="flex flex-col gap-1">
          <h2 id="record-heading" className={eyebrowClass}>
            Record
          </h2>
          <p className="font-display text-5xl leading-none tabular-nums">
            {rankings.record.wins}–{rankings.record.losses}
          </p>
        </div>
        <p className="text-sm text-muted">
          {rankings.record.matches} {rated ? "rated " : ""}
          {rankings.record.matches === 1 ? "match" : "matches"}
        </p>
      </section>

      <section aria-labelledby="rankings-heading" className="flex flex-col gap-2">
        <SectionTitle id="rankings-heading">Rankings</SectionTitle>
        <ul aria-labelledby="rankings-heading" className="flex flex-col gap-2">
          {rankings.scopes.map((scope) => (
            <ScopeRankingEntry key={scope.categoryId ?? "overall"} scope={scope} rated={rated} />
          ))}
        </ul>
        <p className="text-xs text-muted">
          Score is the low end of the rating range. Rankings refresh every 5 minutes; the chart adds one rated snapshot a week.
        </p>
      </section>

      <section aria-labelledby="head-to-head-heading" className="flex flex-col gap-2">
        <SectionTitle id="head-to-head-heading">Head-to-head</SectionTitle>
        {rankings.headToHead.length > 0 ? (
          <ol aria-labelledby="head-to-head-heading" className="flex flex-col gap-1.5">
            {rankings.headToHead.map((h) => (
              <li key={h.opponent.id} className="flex items-center gap-3 border-l-4 border-edge bg-plate px-3 py-2">
                <span aria-hidden className="font-display text-sm text-pink-bright italic">
                  VS
                </span>
                <ContestantThumb src={h.opponent.picture128Url} />
                <Link href={`/contestants/${h.opponent.id}`} className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere] hover:text-orange-bright">
                  {h.opponent.name}
                </Link>
                <span className="text-right">
                  <span className="block font-display text-xl leading-none text-orange-bright tabular-nums">
                    {h.wins}–{h.losses}
                  </span>
                  <span className="block text-xs text-muted">
                    {h.matches} {h.matches === 1 ? "match" : "matches"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <Notice>{rated ? "No rated matches yet." : "No matches yet."}</Notice>
        )}
      </section>

      {contestant.canEdit && (
        <>
          <Disclosure summary="Edit contestant">
            <ContestantForm
              mode={{ kind: "edit", contestant: { id: contestant.id, name: contestant.name, picture512Url: contestant.picture512Url } }}
            />
          </Disclosure>
          <Disclosure summary="Delete contestant" tone="danger">
            <form action={deleteContestantAction.bind(null, contestant.id)} className="flex flex-col gap-3">
              <p className="text-sm text-zinc-100">
                This removes it from every category, along with its matches. Tournaments it was drawn in end early; their
                other matches still count.
              </p>
              <Button variant="danger" className="self-start">
                Delete {contestant.name}
              </Button>
            </form>
          </Disclosure>
        </>
      )}

      <ReportForm targetType="contestant" targetId={contestant.id} label={contestant.name} />
    </Page>
  );
}

function ScopeRankingEntry({ scope, rated }: { scope: ContestantScopeRanking; rated: boolean }) {
  const rankingPath = scope.categoryId === null ? "/rankings/overall" : `/rankings/categories/${scope.categoryId}`;
  const entry = scope.entry;
  return (
    <li className={plateClass("default", "flex flex-col gap-2 px-4 py-3")}>
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={rated ? rankingPath : `${rankingPath}?version=unrated`}
          className="font-display text-lg tracking-wide uppercase hover:text-orange-bright"
        >
          {scope.scopeName}
        </Link>
        {entry ? (
          <span className="shrink-0 text-right">
            <span className="font-display text-3xl leading-none text-pink-bright italic tabular-nums">#{entry.position}</span>
            <span className="text-sm text-muted"> · Score {Math.round(entry.score)}</span>
          </span>
        ) : (
          <span className="shrink-0 text-[13px] text-muted">Not yet judged</span>
        )}
      </div>
      {entry && (
        <p className="text-sm text-muted tabular-nums">
          Rating {Math.round(entry.rating)} ± {Math.round(entry.range)} · {entry.wins}–{entry.losses}
        </p>
      )}
      {scope.history.length > 0 && <RatingChart history={scope.history} scopeName={scope.scopeName} />}
    </li>
  );
}
