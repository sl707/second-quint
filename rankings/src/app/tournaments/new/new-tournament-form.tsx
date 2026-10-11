"use client";

import { useActionState, useState } from "react";
import type { ScopeOption } from "@/server/game";
import { startTournamentAction } from "../actions";

const scopeValue = (scope: ScopeOption) => scope.categoryId ?? "all";

export function NewTournamentForm({ scopes }: { scopes: ScopeOption[] }) {
  const [state, action, pending] = useActionState(startTournamentAction, { error: null });
  const firstPlayable = scopes.find((s) => s.sizes) ?? scopes[0];
  const [selected, setSelected] = useState(firstPlayable ? scopeValue(firstPlayable) : "");
  const scope = scopes.find((s) => scopeValue(s) === selected);
  const [size, setSize] = useState(String(scope?.sizes?.default ?? ""));

  function choose(next: ScopeOption) {
    setSelected(scopeValue(next));
    setSize(String(next.sizes?.default ?? ""));
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Scope</legend>
        {scopes.map((s) => (
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
            <span className="flex-1 font-medium">{s.name}</span>
            <span className="text-sm text-zinc-500">
              {s.sizes ? `${s.contestantCount} contestants` : `${s.contestantCount} of 4 needed`}
            </span>
          </label>
        ))}
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

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-800">
          {state.error}
        </p>
      )}

      <p className="text-sm text-zinc-500">You&apos;re signed out, so this tournament will be unrated.</p>

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
