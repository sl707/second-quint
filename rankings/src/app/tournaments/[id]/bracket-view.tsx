import Image from "next/image";
import type { BracketMatch } from "@/domain/tournament/bracket";
import type { Tournament } from "@/server/game";

export function roundName(round: number, roundCount: number): string {
  if (round === roundCount) return "Final";
  if (round === roundCount - 1) return "Semifinals";
  if (round === roundCount - 2) return "Quarterfinals";
  return `Round ${round}`;
}

export function BracketView({ tournament }: { tournament: Tournament }) {
  const { rounds, thirdPlace, next } = tournament.bracket;
  const isNext = (match: BracketMatch) =>
    !!next && !match.winnerId && match.contestantIds[0] === next.contestantIds[0] && match.contestantIds[1] === next.contestantIds[1];

  return (
    <section aria-labelledby="bracket-heading" className="flex flex-col gap-3">
      <h2 id="bracket-heading" className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Bracket
      </h2>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="flex w-max gap-4">
          {rounds.map((round, r) => (
            <div key={r} className="flex w-44 flex-col gap-2">
              <h3 className="text-xs font-medium text-zinc-500">{roundName(r + 1, rounds.length)}</h3>
              <div className="flex flex-1 flex-col justify-around gap-2">
                {round.map((match, m) => (
                  <MatchCard key={m} match={match} tournament={tournament} current={isNext(match)} />
                ))}
                {r === rounds.length - 1 && thirdPlace && (
                  <div className="flex flex-col gap-1">
                    <h3 className="text-xs font-medium text-zinc-500">Third place</h3>
                    <MatchCard match={thirdPlace} tournament={tournament} current={isNext(thirdPlace)} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MatchCard({ match, tournament, current }: { match: BracketMatch; tournament: Tournament; current: boolean }) {
  return (
    <div
      className={`flex flex-col divide-y divide-zinc-100 rounded-lg border bg-white text-sm ${
        current ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200"
      }`}
    >
      {match.contestantIds.map((id, i) => {
        const contestant = id ? tournament.contestants[id] : null;
        const lost = !!match.winnerId && match.winnerId !== id;
        return (
          <div key={i} className={`flex h-9 items-center gap-2 px-2 ${lost ? "text-zinc-400" : ""}`}>
            {contestant ? (
              <>
                <Image
                  src={contestant.picture128Url}
                  alt=""
                  width={128}
                  height={128}
                  className={`size-6 rounded object-cover ${lost ? "opacity-40" : ""}`}
                />
                <span className={`truncate ${match.winnerId === id && !match.bye ? "font-semibold" : ""}`}>
                  {contestant.name}
                </span>
              </>
            ) : (
              <span className="text-zinc-400">{match.bye ? "Bye" : "—"}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
