import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createVisitorClient } from "@/lib/supabase/server";
import { listPastTournaments, listUnfinishedTournaments, type PastTournament } from "@/server/game";
import { getBanStatus } from "@/server/admin";
import { getProfile } from "@/server/profiles";
import { getPersonalRanking, listPersonalRankingScopes } from "@/server/rankings";
import { isRatedVersion, RankingList, VersionSwitch } from "../../rankings/ranking-view";
import { ReportForm } from "../../report-form";
import { UnfinishedTournaments } from "../../unfinished-tournaments";
import { DeleteAccount } from "./delete-account";
import { PlayerModeration } from "./player-moderation";

const loadProfile = cache((name: string) => getProfile(createAdminClient(), decodeURIComponent(name)));

export async function generateMetadata({ params }: PageProps<"/players/[name]">): Promise<Metadata> {
  const player = await loadProfile((await params).name);
  return { title: player?.displayName ?? "Player not found" };
}

/** `?scope=<category ID>` shows that Category Ranking; without it, the Overall Ranking. `?version=unrated` the Unrated version. */
export default async function ProfilePage({ params, searchParams }: PageProps<"/players/[name]">) {
  const player = await loadProfile((await params).name);
  if (!player) notFound();
  const query = await searchParams;
  const rated = isRatedVersion(query);

  const db = await createVisitorClient();
  const [scopes, tournaments, viewer] = await Promise.all([
    listPersonalRankingScopes(db, player.id),
    listPastTournaments(db, player.id),
    readSignedInPlayer(),
  ]);
  const scope = scopes.find((s) => s.categoryId === query.scope) ?? scopes[0];
  const ranking = (await getPersonalRanking(db, player.id, scope.categoryId, { rated }))!;
  // Only the player sees their own unfinished tournaments' resume links.
  const unfinished = viewer?.playerId === player.id ? await listUnfinishedTournaments(createAdminClient(), viewer) : [];
  const banStatus = viewer?.playerId === player.id ? null : await getBanStatus(createAdminClient(), viewer, player.id);

  const path = `/players/${encodeURIComponent(player.displayName)}`;
  const href = (categoryId: string | null, ratedVersion: boolean) => {
    const search = new URLSearchParams();
    if (categoryId) search.set("scope", categoryId);
    if (!ratedVersion) search.set("version", "unrated");
    const qs = search.toString();
    return qs ? `${path}?${qs}` : path;
  };
  const joined = new Date(player.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "America/New_York",
  });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-2 px-5 py-8">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Player</p>
      <h1 className="text-3xl font-semibold tracking-tight">{player.displayName}</h1>
      <p className="text-zinc-600">Joined {joined}</p>
      {unfinished.length > 0 && (
        <div className="mt-6">
          <UnfinishedTournaments tournaments={unfinished} />
        </div>
      )}

      <section aria-labelledby="personal-rankings-heading" className="mt-8 flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 id="personal-rankings-heading" className="text-xl font-semibold tracking-tight">
            Personal rankings
          </h2>
          <p className="text-sm text-zinc-600">
            Only {player.displayName}&apos;s own picks, {rated ? "rated picks only" : "every pick"}; every match counts the same.
          </p>
        </header>
        <nav aria-label="Personal ranking scope" className="flex flex-wrap gap-2">
          {scopes.map((s) => {
            const current = s.categoryId === scope.categoryId;
            return (
              <Link
                key={s.categoryId ?? "overall"}
                href={href(s.categoryId, rated)}
                aria-current={current ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-sm ${current ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"}`}
              >
                {s.name}
              </Link>
            );
          })}
        </nav>
        <VersionSwitch rated={rated} ratedHref={href(scope.categoryId, true)} unratedHref={href(scope.categoryId, false)} />
        <RankingList
          ranking={ranking}
          empty={`${player.displayName} hasn't played any ${rated ? "rated " : ""}matches here yet.`}
        />
      </section>

      <section aria-labelledby="past-tournaments-heading" className="mt-8 flex flex-col gap-3">
        <h2 id="past-tournaments-heading" className="text-xl font-semibold tracking-tight">
          Past tournaments
        </h2>
        {tournaments.length > 0 ? (
          <ul aria-labelledby="past-tournaments-heading" className="flex flex-col gap-2">
            {tournaments.map((t) => (
              <li key={t.id}>
                <PastTournamentItem tournament={t} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-600">{player.displayName} hasn&apos;t played a tournament yet.</p>
        )}
      </section>

      {banStatus && (
        <div className="mt-8">
          <PlayerModeration key={player.displayName} playerId={player.id} displayName={player.displayName} status={banStatus} />
        </div>
      )}

      {viewer?.playerId === player.id ? (
        <div className="mt-8">
          <DeleteAccount displayName={player.displayName} />
        </div>
      ) : (
        <div className="mt-8">
          <ReportForm targetType="profile" targetId={player.id} label={player.displayName} />
        </div>
      )}
    </main>
  );
}

function PastTournamentItem({ tournament: t }: { tournament: PastTournament }) {
  const date = new Date(t.createdAt).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "America/New_York" });
  const summary = (
    <span className="flex flex-1 flex-wrap items-baseline justify-between gap-x-3">
      <span>
        <span className="font-medium">{t.scopeName}</span>
        <span className="text-zinc-600">
          {" "}
          · {t.size} contestants · {t.rated ? "Rated" : "Unrated"} · {date}
        </span>
      </span>
      <span className="text-sm text-zinc-700">
        {t.ranking
          ? `Winner: ${t.ranking[0]?.contestants[0]?.name ?? "—"}`
          : t.status === "given_up"
            ? "Given up"
            : t.status === "removed"
              ? "Removed"
              : "In progress"}
      </span>
    </span>
  );
  if (!t.ranking) return <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">{summary}</div>;
  return (
    <details className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <summary className="flex cursor-pointer list-none">{summary}</summary>
      <ol aria-label="Tournament ranking" className="mt-3 flex flex-col gap-2">
        {t.ranking.map((tier) => (
          <li key={tier.place} className="flex gap-3">
            <span className="w-20 shrink-0 pt-1 text-sm font-semibold">{tier.place}</span>
            <span className="flex flex-wrap gap-2">
              {tier.contestants.map((c) => (
                <span key={c.id} className="flex items-center gap-2 text-sm">
                  <Image src={c.picture128Url} alt="" width={128} height={128} className="size-8 rounded object-cover" />
                  {c.name}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
