"use client";

import { useActionState } from "react";
import { undoLastPickAction } from "../actions";

/** Takes back the most recent pick, saying why if it can't. */
export function UndoButton({ tournamentId }: { tournamentId: string }) {
  const [state, action] = useActionState(undoLastPickAction.bind(null, tournamentId), { message: null });
  return (
    <form action={action} className="flex flex-col items-center gap-2">
      <button
        type="submit"
        className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500"
      >
        Undo
      </button>
      {state.message && (
        <p role="status" className="max-w-sm text-center text-sm text-zinc-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
