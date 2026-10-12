import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createVisitorClient } from "@/lib/supabase/server";
import { findMergeSurvivor, getContestant } from "@/server/catalog";
import { getContestantStanding, type ContestantScopeStanding } from "@/server/rankings";
import { AddedBy } from "../../added-by";
import { ReportForm } from "../../report-form";
import { isRatedVersion, VersionSwitch } from "../../rankings/ranking-view";
import { deleteContestantAction } from "../actions";
import { ContestantForm } from "../contestant-form";
import { RatingChart } from "./rating-chart";

const loadContestant = cache(async (id: string) => getContestant(createAdminClient(), id, await readSignedInPlayer()));

export async function generateMetadata({ params }: PageProps<"/contestants/[id]">): Promise<Metadata> {
  return { title: (await loadContestant((await params).id))?.name ?? "Contestant not found" };
}

const sectionHeading = "text-sm font-medium uppercase tracking-wide text-zinc-500";

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
  const standing = (await getContestantStanding(await createVisitorClient(), contestant.id, { rated }))!;
  const path = `/contestants/${contestant.id}`;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Contestant</p>
        <Image
          src={contestant.picture512Url}
          alt={contestant.name}
          width={512}
          height={512}
          className="aspect-square w-full max-w-xs rounded-2xl object-cover"
        />
        <h1 className="text-3xl font-semibold tracking-tight">{contestant.name}</h1>
        <AddedBy by={contestant.createdBy} />
      </header>

      <VersionSwitch rated={rated} ratedHref={path} unratedHref={`${path}?version=unrated`} />

      <section aria-labelledby="record-heading" className="flex flex-col gap-1">
        <h2 id="record-heading" className={sectionHeading}>
          Record
        </h2>
        <p className="text-2xl font-semibold tabular-nums">
          {standing.record.wins}–{standing.record.losses}
        </p>
        <p className="text-sm text-zinc-600">
          {standing.record.matches} {rated ? "rated " : ""}
          {standing.record.matches === 1 ? "match" : "matches"}
        </p>
      </section>

      <section aria-labelledby="standings-heading" className="flex flex-col gap-2">
        <h2 id="standings-heading" className={sectionHeading}>
          Standings
        </h2>
        <ul aria-labelledby="standings-heading" className="flex flex-col gap-2">
          {standing.scopes.map((scope) => (
            <ScopeStanding key={scope.categoryId ?? "overall"} scope={scope} rated={rated} />
          ))}
        </ul>
        <p className="text-xs text-zinc-500">
          Score is the low end of the rating range. Rankings refresh every 5 minutes; the chart adds one rated snapshot a week.
        </p>
      </section>

      <section aria-labelledby="head-to-head-heading" className="flex flex-col gap-2">
        <h2 id="head-to-head-heading" className={sectionHeading}>
          Head-to-head
        </h2>
        {standing.headToHead.length > 0 ? (
          <ol aria-labelledby="head-to-head-heading" className="flex flex-col gap-2">
            {standing.headToHead.map((h) => (
              <li key={h.opponent.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2">
                <Image src={h.opponent.picture128Url} alt="" width={128} height={128} className="size-10 rounded-lg object-cover" />
                <Link href={`/contestants/${h.opponent.id}`} className="flex-1 font-medium hover:underline">
                  {h.opponent.name}
                </Link>
                <span className="text-right">
                  <span className="block font-semibold tabular-nums">
                    {h.wins}–{h.losses}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {h.matches} {h.matches === 1 ? "match" : "matches"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-zinc-600">{rated ? "No rated matches yet." : "No matches yet."}</p>
        )}
      </section>

      {contestant.canEdit && (
        <>
          <details className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <summary className="cursor-pointer font-medium">Edit contestant</summary>
            <div className="pt-4">
              <ContestantForm
                mode={{ kind: "edit", contestant: { id: contestant.id, name: contestant.name, picture512Url: contestant.picture512Url } }}
              />
            </div>
          </details>
          <details className="rounded-xl border border-red-200 bg-white px-4 py-3">
            <summary className="cursor-pointer font-medium text-red-800">Delete contestant</summary>
            <form action={deleteContestantAction.bind(null, contestant.id)} className="flex flex-col gap-3 pt-3">
              <p className="text-sm text-zinc-600">
                This removes it from every category, along with its matches. Tournaments it was drawn in end early; their
                other matches still count.
              </p>
              <button type="submit" className="self-start rounded-xl bg-red-700 px-4 py-2 font-medium text-white">
                Delete {contestant.name}
              </button>
            </form>
          </details>
        </>
      )}

      <ReportForm targetType="contestant" targetId={contestant.id} label={contestant.name} />
    </main>
  );
}

function ScopeStanding({ scope, rated }: { scope: ContestantScopeStanding; rated: boolean }) {
  const rankingPath = scope.categoryId === null ? "/rankings/overall" : `/rankings/categories/${scope.categoryId}`;
  const s = scope.standing;
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <Link href={rated ? rankingPath : `${rankingPath}?version=unrated`} className="font-medium hover:underline">
          {scope.scopeName}
        </Link>
        {s ? (
          <span className="text-right">
            <span className="text-lg font-semibold tabular-nums">#{s.position}</span>
            <span className="text-sm text-zinc-500"> · Score {Math.round(s.score)}</span>
          </span>
        ) : (
          <span className="text-sm text-zinc-500">Not yet judged</span>
        )}
      </div>
      {s && (
        <p className="text-sm text-zinc-600 tabular-nums">
          Rating {Math.round(s.rating)} ± {Math.round(s.range)} · {s.wins}–{s.losses}
        </p>
      )}
      {scope.history.length > 0 && <RatingChart history={scope.history} scopeName={scope.scopeName} />}
    </li>
  );
}
