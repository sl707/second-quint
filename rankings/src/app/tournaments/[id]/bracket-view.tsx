import type { BracketMatch } from "@/domain/tournament/bracket";
import { roundName, THIRD_PLACE_MATCH } from "@/domain/tournament/stage";
import type { Tournament } from "@/server/game";
import { ContestantThumb } from "../../ui/contestant-image";
import { eyebrowClass, SectionTitle } from "../../ui/frame";

export function BracketView({ tournament }: { tournament: Tournament }) {
  const { rounds, thirdPlace } = tournament.bracket;
  const next = tournament.status === "in_progress" ? tournament.bracket.next : null;
  const isNext = (match: BracketMatch) =>
    !!next && !match.winnerId && match.contestantIds[0] === next.contestantIds[0] && match.contestantIds[1] === next.contestantIds[1];

  return (
    <section aria-labelledby="bracket-heading" className="flex flex-col gap-3">
      <div className="px-4 md:px-6">
        <SectionTitle id="bracket-heading">Bracket</SectionTitle>
      </div>
      <div className="overflow-x-auto px-4 pb-2 md:px-6">
        <div className="flex w-max gap-3">
          {rounds.map((round, r) => (
            <div key={r} className="flex w-44 flex-col gap-2">
              <h3 className={eyebrowClass}>{roundName(r + 1, rounds.length)}</h3>
              <div className="flex flex-1 flex-col justify-around gap-2">
                {round.map((match, m) => (
                  <MatchCard key={m} match={match} tournament={tournament} current={isNext(match)} />
                ))}
                {r === rounds.length - 1 && thirdPlace && (
                  <div className="flex flex-col gap-1">
                    <h3 className={eyebrowClass}>{THIRD_PLACE_MATCH}</h3>
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
      aria-current={current ? "step" : undefined}
      className={`-skew-x-6 border-l-4 bg-plate ${current ? "border-pink shadow-[0_0_16px_-2px_var(--color-pink)]" : "border-edge"}`}
    >
      {match.contestantIds.map((id, i) => {
        const contestant = id ? tournament.contestants[id] : null;
        const lost = !!match.winnerId && match.winnerId !== id;
        const won = !!match.winnerId && match.winnerId === id && !match.bye;
        return (
          <div
            key={i}
            className={`flex h-9 skew-x-6 items-center gap-2 px-2 text-sm ${lost ? "text-zinc-400 line-through" : ""} ${won ? "font-bold text-orange-bright" : ""}`}
          >
            {contestant ? (
              <>
                <ContestantThumb src={contestant.picture128Url} size="xs" dimmed={lost} />
                <span className="truncate">{contestant.name}</span>
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
