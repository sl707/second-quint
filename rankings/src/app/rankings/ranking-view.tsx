import Image from "next/image";
import Link from "next/link";
import type { GlobalRanking, PersonalRanking } from "@/server/rankings";

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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/rankings" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Rankings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{ranking.scopeName}</h1>
        <p className="text-sm text-zinc-600">
          {kind === "Category Ranking" ? "Category Ranking · " : ""}
          {ranking.rated ? "Rated · rated picks only" : "Unrated · every pick"}, recent matches count more
        </p>
      </header>

      <VersionSwitch rated={ranking.rated} ratedHref={path} unratedHref={`${path}?version=unrated`} />

      {ranking.refreshedAt === null ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-600">
          This ranking hasn&apos;t been calculated yet. Rankings refresh every 5 minutes.
        </p>
      ) : (
        <>
          <RankingList ranking={ranking} />
          <p className="text-xs text-zinc-500">
            Updated {new Date(ranking.refreshedAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })} ET.
            Rankings refresh every 5 minutes.
          </p>
        </>
      )}
    </main>
  );
}

/** The Rated / Unrated switch, as two links. */
export function VersionSwitch({ rated, ratedHref, unratedHref }: { rated: boolean; ratedHref: string; unratedHref: string }) {
  const versionClass = (current: boolean) =>
    `flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium ${current ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"}`;
  return (
    <nav aria-label="Ranking version" className="flex gap-1 rounded-xl bg-zinc-200 p-1">
      <Link href={ratedHref} aria-current={rated ? "page" : undefined} className={versionClass(rated)}>
        Rated
      </Link>
      <Link href={unratedHref} aria-current={rated ? undefined : "page"} className={versionClass(!rated)}>
        Unrated
      </Link>
    </nav>
  );
}

/** The ranked contestants by score, then the ones not yet judged. */
export function RankingList({ ranking, empty }: { ranking: GlobalRanking | PersonalRanking; empty?: string }) {
  return (
    <>
      {ranking.ranked.length > 0 ? (
        <ol aria-label={ranking.scopeName} className="flex flex-col gap-2">
          {ranking.ranked.map((row) => (
            <li key={row.contestant.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2">
              <span className="w-8 text-right text-sm font-semibold text-zinc-500">{row.position}</span>
              <Image
                src={row.contestant.picture128Url}
                alt=""
                width={128}
                height={128}
                className="size-12 rounded-lg object-cover"
              />
              <span className="flex-1 font-medium">{row.contestant.name}</span>
              <span className="text-right">
                <span className="block text-lg font-semibold tabular-nums">{Math.round(row.score)}</span>
                <span className="block text-xs text-zinc-500">
                  Score · {row.wins}–{row.losses}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-zinc-600">
          {empty ?? (ranking.rated ? "No rated matches have been played here yet." : "No matches have been played here yet.")}
        </p>
      )}

      {ranking.notYetJudged.length > 0 && (
        <section aria-labelledby="not-yet-judged" className="flex flex-col gap-2">
          <h2 id="not-yet-judged" className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Not yet judged
          </h2>
          <ul aria-labelledby="not-yet-judged" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ranking.notYetJudged.map((contestant) => (
              <li key={contestant.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-sm">
                <Image
                  src={contestant.picture128Url}
                  alt=""
                  width={128}
                  height={128}
                  className="size-8 rounded object-cover"
                />
                {contestant.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
