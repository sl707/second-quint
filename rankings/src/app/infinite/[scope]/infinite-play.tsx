"use client";

import Image from "next/image";
import { useActionState } from "react";
import type { InfinitePair } from "@/server/game";
import { playInfiniteAction } from "../actions";

export function InfinitePlay({ pair }: { pair: InfinitePair }) {
  const [state, action, pending] = useActionState(playInfiniteAction, { message: null, picks: 0 });

  return (
    <section aria-label="Current pair" className="flex flex-col gap-4">
      <div className="flex flex-col items-stretch gap-2 md:flex-row md:gap-6">
        {pair.contestants.map((contestant, i) => {
          const other = pair.contestants[1 - i];
          return (
            <div key={contestant.id} className="contents">
              {i === 1 && (
                <span className="self-center text-xs font-semibold uppercase text-zinc-400" aria-hidden>
                  vs
                </span>
              )}
              <form action={action} className="flex-1">
                <input type="hidden" name="pairId" value={pair.pairId} />
                <input type="hidden" name="winnerId" value={contestant.id} />
                <input type="hidden" name="winnerName" value={contestant.name} />
                <input type="hidden" name="loserName" value={other.name} />
                <button
                  type="submit"
                  disabled={pending}
                  aria-label={`Pick ${contestant.name}`}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-3 text-left shadow-sm transition hover:border-zinc-900 active:scale-[0.99] disabled:opacity-60 md:flex-col md:items-center md:p-4 md:text-center"
                >
                  <Image
                    src={contestant.picture512Url}
                    alt=""
                    width={512}
                    height={512}
                    priority
                    className="aspect-square w-28 shrink-0 rounded-xl object-cover sm:w-36 md:w-full md:max-w-72"
                  />
                  <span className="text-lg font-semibold md:text-xl">{contestant.name}</span>
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <form action={action} className="flex justify-center">
        <input type="hidden" name="pairId" value={pair.pairId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500 disabled:opacity-60"
        >
          Skip
        </button>
      </form>

      <div role="status" className="flex min-h-10 flex-col items-center text-center text-sm text-zinc-600">
        <p>{state.message}</p>
        {state.picks > 0 && (
          <p className="text-zinc-500">
            {state.picks} {state.picks === 1 ? "pick" : "picks"} so far
          </p>
        )}
      </div>
    </section>
  );
}
