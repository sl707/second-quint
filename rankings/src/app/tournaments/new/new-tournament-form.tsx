"use client";

import { useActionState, useState } from "react";
import { tournamentRatedStatus, unratedReasonMessage } from "@/domain/allowance/rated-status";
import type { ScopeOption } from "@/server/game";
import { startTournamentAction } from "../actions";
import { AllowanceCountdown } from "./allowance-countdown";

const scopeValue = (scope: { categoryId: string | null }) => scope.categoryId ?? "all";

/** The signed-in player's rated allowance today, by scope value. */
export type AllowanceView = {
  resetsAt: string;
  renderedAt: string;
  hasUnfinishedRatedTournament: boolean;
  remaining: Record<string, { allowance: number; remaining: number }>;
};

export function NewTournamentForm({ scopes, allowance }: { scopes: ScopeOption[]; allowance: AllowanceView | null }) {
  const [state, action, pending] = useActionState(startTournamentAction, { error: null });
  const firstPlayable = scopes.find((s) => s.sizes) ?? scopes[0];
  const [selected, setSelected] = useState(firstPlayable ? scopeValue(firstPlayable) : "");
  const scope = scopes.find((s) => scopeValue(s) === selected);
  const [size, setSize] = useState(String(scope?.sizes?.default ?? ""));
  const [unrated, setUnrated] = useState(false);

  function choose(next: ScopeOption) {
    setSelected(scopeValue(next));
    setSize(String(next.sizes?.default ?? ""));
  }

  const sizeNumber = Number(size);
  const validSize =
    scope?.sizes && Number.isInteger(sizeNumber) && sizeNumber >= scope.sizes.min && sizeNumber <= scope.sizes.max;
  const remainingAllowance = (scope && allowance?.remaining[scopeValue(scope)]?.remaining) ?? 0;
  const status = validSize
    ? tournamentRatedStatus({
        signedIn: allowance !== null,
        choseUnrated: unrated,
        handPicked: false,
        hasUnfinishedRatedTournament: allowance?.hasUnfinishedRatedTournament ?? false,
        size: sizeNumber,
        remainingAllowance,
      })
    : null;

  return (
    <form action={action} className="flex flex-col gap-6">
      {allowance && (
        <p className="text-sm text-zinc-600">
          Rated allowance resets at midnight Eastern, in{" "}
          <AllowanceCountdown resetsAt={allowance.resetsAt} renderedAt={allowance.renderedAt} />.
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Scope</legend>
        {scopes.map((s) => {
          const left = allowance?.remaining[scopeValue(s)];
          return (
            <label
              key={scopeValue(s)}
              className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 ${
                s.sizes ? "cursor-pointer has-[:checked]:border-zinc-900 has-[:checked]:ring-1 has-[:checked]:ring-zinc-900" : "opacity-50"
              }`}
            >
              <input
                type="radio"
                name="scope"
                value={scopeValue(s)}
                checked={selected === scopeValue(s)}
                disabled={!s.sizes}
                onChange={() => choose(s)}
                className="accent-zinc-900"
              />
              <span className="flex flex-1 flex-col">
                <span className="font-medium">{s.name}</span>
                {left && (
                  <span className="text-xs text-zinc-500">
                    {left.remaining} of {left.allowance} rated matches left today
                  </span>
                )}
              </span>
              <span className="text-sm text-zinc-500">
                {s.sizes ? `${s.contestantCount} contestants` : `${s.contestantCount} of 4 needed`}
              </span>
            </label>
          );
        })}
      </fieldset>

      {scope?.sizes && (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium uppercase tracking-wide text-zinc-500">Size</span>
          <input
            type="number"
            name="size"
            inputMode="numeric"
            min={scope.sizes.min}
            max={scope.sizes.max}
            required
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-lg"
          />
          <span className="text-sm text-zinc-500">
            From {scope.sizes.min} to {scope.sizes.max} contestants, drawn at random.
          </span>
        </label>
      )}

      {allowance && (
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="unrated"
            checked={unrated}
            onChange={(e) => setUnrated(e.target.checked)}
            className="size-5 accent-zinc-900"
          />
          <span>Play unrated</span>
        </label>
      )}

      {status && (
        <div role="status" className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="font-medium">{status.rated ? "This tournament will be rated." : "This tournament will be unrated."}</p>
          <p className="text-sm text-zinc-600">
            {status.rated
              ? `Starting reserves all ${sizeNumber} of its matches from today's rated allowance, even if you don't finish.`
              : unratedReasonMessage(status.reason, { size: sizeNumber, remainingAllowance })}
          </p>
          <input type="hidden" name="expectRated" value={status.rated ? "1" : ""} />
        </div>
      )}

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-800">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={!scope?.sizes || pending}
        className="rounded-xl bg-zinc-900 px-4 py-3 text-lg font-medium text-white disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start tournament"}
      </button>
    </form>
  );
}
