"use client";

import Image from "next/image";
import { useActionState } from "react";
import type { ContestantCard } from "@/server/game";
import { pickWinnerAction } from "../actions";

/** The current match's two contestants as pick buttons, with why a pick was refused, if it was. */
export function MatchPicker({
  tournamentId,
  matchIndex,
  contestants,
}: {
  tournamentId: string;
  matchIndex: number;
  contestants: ContestantCard[];
}) {
  const [state, action] = useActionState(pickWinnerAction, { message: null });
  return (
    <>
      <div className="flex flex-col items-stretch gap-2 md:flex-row md:gap-6">
        {contestants.map((contestant, i) => (
          <div key={contestant.id} className="contents">
            {i === 1 && (
              <span className="self-center text-xs font-semibold uppercase text-zinc-400" aria-hidden>
                vs
              </span>
            )}
            <form action={action} className="flex-1">
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <input type="hidden" name="matchIndex" value={matchIndex} />
              <input type="hidden" name="winnerId" value={contestant.id} />
              <button
                type="submit"
                aria-label={`Pick ${contestant.name}`}
                className="group flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-3 text-left shadow-sm transition hover:border-zinc-900 active:scale-[0.99] md:flex-col md:items-center md:p-4 md:text-center"
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
        ))}
      </div>
      {state.message && (
        <p role="status" className="text-center text-sm text-zinc-700">
          {state.message}
        </p>
      )}
    </>
  );
}
