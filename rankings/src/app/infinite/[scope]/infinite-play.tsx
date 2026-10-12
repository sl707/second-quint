"use client";

import { useActionState } from "react";
import type { InfinitePair } from "@/server/game";
import { Button } from "../../ui/button";
import { Versus } from "../../ui/versus";
import { playInfiniteAction } from "../actions";

export function InfinitePlay({ pair }: { pair: InfinitePair }) {
  const [state, action, pending] = useActionState(playInfiniteAction, { message: null, picks: 0 });
  const outOfSkips = pair.play.rated && pair.play.ratedSkipsLeft === 0;
  const lastRatedPick = pair.play.rated && pair.play.ratedPicksLeft === 1;

  return (
    <section aria-label="Current pair" className="flex flex-col gap-4">
      <Versus
        action={action}
        contestants={pair.contestants}
        disabled={pending}
        fields={(contestant, i) => (
          <>
            <input type="hidden" name="pairId" value={pair.pairId} />
            <input type="hidden" name="winnerId" value={contestant.id} />
            <input type="hidden" name="winnerName" value={contestant.name} />
            <input type="hidden" name="loserName" value={pair.contestants[1 - i].name} />
            {lastRatedPick && <input type="hidden" name="lastRatedPick" value="1" />}
          </>
        )}
      />

      <form action={action} className="flex flex-col items-center gap-2 px-4">
        <input type="hidden" name="pairId" value={pair.pairId} />
        <Button variant="secondary" disabled={pending || outOfSkips}>
          Skip <span aria-hidden>»</span>
        </Button>
        {outOfSkips && (
          <p className="max-w-sm text-center text-sm text-zinc-100">No rated skips left today. Pick a winner, or play unrated to skip.</p>
        )}
      </form>

      <div role="status" className="flex min-h-12 flex-col items-center gap-0.5 px-4 text-center text-sm text-zinc-100">
        <p>{state.message}</p>
        {state.picks > 0 && (
          <p className="font-display text-lg tracking-wide text-orange-bright uppercase">
            {state.picks} {state.picks === 1 ? "pick" : "picks"} so far
          </p>
        )}
      </div>
    </section>
  );
}
