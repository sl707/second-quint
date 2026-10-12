import Link from "next/link";
import type { UnfinishedTournament } from "@/server/game";
import { eyebrowClass } from "./ui/frame";

/** Reminds the person of their unfinished tournaments, each with a link to resume it. */
export function UnfinishedTournaments({ tournaments }: { tournaments: UnfinishedTournament[] }) {
  if (tournaments.length === 0) return null;
  return (
    <section className="flex w-full flex-col gap-2" aria-labelledby="unfinished-heading">
      <h2 id="unfinished-heading" className={eyebrowClass}>
        Unfinished tournaments
      </h2>
      <ul className="flex flex-col gap-2">
        {tournaments.map((t) => (
          <li key={t.id}>
            <Link
              href={`/tournaments/${t.id}`}
              className="flex items-center justify-between gap-3 border-2 border-orange bg-plate px-4 py-3 text-left hover:bg-raised"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-display text-lg tracking-wide uppercase">{t.scopeName}</span>
                <span className="text-[13px] text-muted">
                  {t.size} contestants · {t.rated ? "Rated" : "Unrated"}
                </span>
              </span>
              <span className="shrink-0 font-display text-base tracking-wide text-orange-bright uppercase">
                Resume · {t.matchesLeft} left
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
