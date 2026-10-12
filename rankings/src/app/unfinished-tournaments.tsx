import Link from "next/link";
import type { UnfinishedTournament } from "@/server/game";

/** Reminds the person of their unfinished tournaments, each with a link to resume it. */
export function UnfinishedTournaments({ tournaments }: { tournaments: UnfinishedTournament[] }) {
  if (tournaments.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="unfinished-heading">
      <h2 id="unfinished-heading" className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Unfinished tournaments
      </h2>
      <ul className="flex flex-col gap-2">
        {tournaments.map((t) => (
          <li key={t.id}>
            <Link
              href={`/tournaments/${t.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 hover:border-amber-500"
            >
              <span>
                <span className="font-medium">{t.scopeName}</span>
                <span className="text-zinc-600">
                  {" "}
                  · {t.size} contestants · {t.rated ? "Rated" : "Unrated"}
                </span>
              </span>
              <span className="shrink-0 text-sm text-zinc-700">Resume · {t.matchesLeft} left</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
