import type { GlobalRanking, PersonalRanking } from "@/server/rankings";
import { SegmentedLinks } from "../ui/chip";
import { ContestantThumb } from "../ui/contestant-image";
import { eyebrowClass, Page, PageHeader, SectionTitle } from "../ui/frame";
import { Notice } from "../ui/plate";
import { RankRow } from "../ui/rank-row";

/** `?version=unrated` shows the Unrated Ranking; without it, the Rated Ranking. */
export function isRatedVersion(searchParams: Record<string, string | string[] | undefined>) {
  return searchParams.version !== "unrated";
}

export function RankingView({
  ranking,
  kind,
  path,
}: {
  ranking: GlobalRanking;
  kind: "Overall Ranking" | "Category Ranking";
  path: string;
}) {
  return (
    <Page>
      <PageHeader back={{ href: "/rankings", label: "Rankings" }} kicker={kind} title={ranking.scopeName} neon>
        <p>{ranking.rated ? "Rated · rated picks only" : "Unrated · every pick"}, recent matches count more</p>
      </PageHeader>

      <VersionSwitch rated={ranking.rated} ratedHref={path} unratedHref={`${path}?version=unrated`} />

      {ranking.refreshedAt === null ? (
        <Notice>This ranking hasn&apos;t been calculated yet. Rankings refresh every 5 minutes.</Notice>
      ) : (
        <>
          <RankingList ranking={ranking} />
          <p className="text-xs text-muted">
            Updated {new Date(ranking.refreshedAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })} ET.
            Rankings refresh every 5 minutes.
          </p>
        </>
      )}
    </Page>
  );
}

/** The Rated / Unrated switch, as two links. */
export function VersionSwitch({ rated, ratedHref, unratedHref }: { rated: boolean; ratedHref: string; unratedHref: string }) {
  return (
    <SegmentedLinks
      label="Ranking version"
      items={[
        { href: ratedHref, label: "Rated", current: rated },
        { href: unratedHref, label: "Unrated", current: !rated },
      ]}
    />
  );
}

/** The ranked contestants by score, then the ones not yet judged. */
export function RankingList({ ranking, empty }: { ranking: GlobalRanking | PersonalRanking; empty?: string }) {
  return (
    <>
      {ranking.ranked.length > 0 ? (
        <div className="flex flex-col">
          <div aria-hidden className={`grid grid-cols-[3rem_1fr_auto] gap-3 border-b-2 border-pink pr-2 pb-1 ${eyebrowClass}`}>
            <span className="text-center">#</span>
            <span>Contestant</span>
            <span>Score</span>
          </div>
          <ol aria-label={ranking.scopeName} className="flex flex-col">
            {ranking.ranked.map((row) => (
              <RankRow
                key={row.contestant.id}
                position={row.position}
                contestant={row.contestant}
                score={row.score}
                detail={
                  <>
                    Score · {row.wins}–{row.losses}
                  </>
                }
              />
            ))}
          </ol>
        </div>
      ) : (
        <Notice>{empty ?? (ranking.rated ? "No rated matches have been played here yet." : "No matches have been played here yet.")}</Notice>
      )}

      {ranking.notYetJudged.length > 0 && (
        <section aria-labelledby="not-yet-judged" className="flex flex-col gap-2">
          <SectionTitle id="not-yet-judged">Not yet judged</SectionTitle>
          <ul aria-labelledby="not-yet-judged" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {ranking.notYetJudged.map((contestant) => (
              <li key={contestant.id} className="flex flex-col items-center gap-1.5 border-2 border-edge bg-plate p-2 text-center">
                <ContestantThumb src={contestant.picture128Url} size="lg" />
                <span className="line-clamp-2 text-[13px] font-semibold [overflow-wrap:anywhere]">{contestant.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
