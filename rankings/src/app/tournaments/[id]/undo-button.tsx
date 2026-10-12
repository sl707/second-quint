"use client";

import { useActionState } from "react";
import { Button } from "../../ui/button";
import { undoLastPickAction } from "../actions";

/** Takes back the most recent pick, saying why if it can't. */
export function UndoButton({ tournamentId }: { tournamentId: string }) {
  const [state, action] = useActionState(undoLastPickAction.bind(null, tournamentId), { message: null });
  return (
    <form action={action} className="flex flex-col items-center gap-2">
      <Button variant="secondary">
        <span aria-hidden>↶ </span>Undo
      </Button>
      {state.message && (
        <p role="status" className="max-w-sm text-center text-sm text-zinc-100">
          {state.message}
        </p>
      )}
    </form>
  );
}
