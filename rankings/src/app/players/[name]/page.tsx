import type { Metadata } from "next";
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
import { ChipNav } from "../../ui/chip";
import { ContestantThumb } from "../../ui/contestant-image";
import { eyebrowClass, Page, SectionTitle } from "../../ui/frame";
import { Notice, plateClass } from "../../ui/plate";
import { DeleteAccount } from "./delete-account";
import { PlayerModeration } from "./player-moderation";

function decodeName(name: string): string | null {
  try {
    return decodeURIComponent(name);
  } catch {
    return null;
  }
}

const loadProfile = cache(async (name: string) => {
  const decoded = decodeName(name);
  return decoded === null ? null : getProfile(createAdminClient(), decoded);
});

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
    <Page>
      <header className="flex flex-col gap-2 border-l-4 border-pink bg-plate px-4 py-4 shadow-[6px_6px_0_var(--color-orange)]">
        <p className={eyebrowClass}>Player</p>
        <h1 className="font-display text-4xl leading-none uppercase italic [overflow-wrap:anywhere] md:text-5xl">
          <span className="animate-neon">{player.displayName}</span>
        </h1>
        <p className="text-sm text-muted">Joined {joined}</p>
      </header>
      <UnfinishedTournaments tournaments={unfinished} />

      <section aria-labelledby="personal-rankings-heading" className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <SectionTitle id="personal-rankings-heading">Personal rankings</SectionTitle>
          <p className="text-sm text-muted">
            Only {player.displayName}&apos;s own picks, {rated ? "rated picks only" : "every pick"}; every match counts the same.
          </p>
        </header>
        <ChipNav
          label="Personal ranking scope"
          items={scopes.map((s) => ({
            key: s.categoryId ?? "overall",
            href: href(s.categoryId, rated),
            label: s.name,
            current: s.categoryId === scope.categoryId,
          }))}
        />
        <VersionSwitch rated={rated} ratedHref={href(scope.categoryId, true)} unratedHref={href(scope.categoryId, false)} />
        <RankingList
          ranking={ranking}
          empty={`${player.displayName} hasn't played any ${rated ? "rated " : ""}matches here yet.`}
        />
      </section>

      <section aria-labelledby="past-tournaments-heading" className="flex flex-col gap-3">
        <SectionTitle id="past-tournaments-heading">Past tournaments</SectionTitle>
        {tournaments.length > 0 ? (
          <ul aria-labelledby="past-tournaments-heading" className="flex flex-col gap-2">
            {tournaments.map((t) => (
              <li key={t.id}>
                <PastTournamentItem tournament={t} />
              </li>
            ))}
          </ul>
        ) : (
          <Notice>{player.displayName} hasn&apos;t played a tournament yet.</Notice>
        )}
      </section>

      {banStatus && <PlayerModeration key={player.displayName} playerId={player.id} displayName={player.displayName} status={banStatus} />}

      {viewer?.playerId === player.id ? (
        <DeleteAccount displayName={player.displayName} />
      ) : (
        <ReportForm targetType="profile" targetId={player.id} label={player.displayName} />
      )}
    </Page>
  );
}

function PastTournamentItem({ tournament: t }: { tournament: PastTournament }) {
  const date = new Date(t.createdAt).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "America/New_York" });
  const summary = (
    <span className="flex flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="min-w-0">
        <span className="font-display text-lg tracking-wide uppercase">{t.scopeName}</span>
        <span className="block text-[13px] text-muted">
          {t.size} contestants · {t.rated ? "Rated" : "Unrated"} · {date}
        </span>
      </span>
      <span className={`text-sm font-semibold ${t.ranking ? "text-orange-bright" : "text-zinc-100"}`}>
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
  if (!t.ranking) return <div className={plateClass("default", "px-4 py-3")}>{summary}</div>;
  return (
    <details className={plateClass("default", "group px-4 py-3 open:border-orange")}>
      <summary className="flex cursor-pointer list-none [&::-webkit-details-marker]:hidden">{summary}</summary>
      <ol aria-label="Tournament ranking" className="mt-3 flex flex-col gap-1.5 border-t-2 border-edge pt-3">
        {t.ranking.map((tier, i) => (
          <li key={tier.place} className="flex gap-3">
            <span className={`w-20 shrink-0 pt-1 font-display text-base uppercase italic ${i === 0 ? "text-pink-bright" : "text-orange-bright"}`}>
              {tier.place}
            </span>
            <span className="flex flex-wrap gap-2">
              {tier.contestants.map((c) => (
                <span key={c.id} className="flex items-center gap-2 text-sm">
                  <ContestantThumb src={c.picture128Url} size="sm" />
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
