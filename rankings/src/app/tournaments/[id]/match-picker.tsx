"use client";

import { useActionState } from "react";
import type { ContestantCard } from "@/server/game";
import { Notice } from "../../ui/plate";
import { Versus } from "../../ui/versus";
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
      <Versus
        action={action}
        contestants={contestants}
        fields={(contestant) => (
          <>
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <input type="hidden" name="matchIndex" value={matchIndex} />
            <input type="hidden" name="winnerId" value={contestant.id} />
          </>
        )}
      />
      {state.message && (
        <div className="px-4">
          <Notice tone="accent" role="status" className="text-center">
            {state.message}
          </Notice>
        </div>
      )}
    </>
  );
}
