"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { tournamentRatedStatus, unratedReasonMessage } from "@/domain/allowance/rated-status";
import { MIN_TOURNAMENT_SIZE } from "@/domain/tournament/size";
import type { ContestantCard, ScopeOption } from "@/server/game";
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

/** The contestants of the scope (by scope value) the player is hand-picking from, loaded via `?pick=`. */
export type PickingView = { scope: string; contestants: ContestantCard[] };

export function NewTournamentForm({
  scopes,
  allowance,
  picking,
}: {
  scopes: ScopeOption[];
  allowance: AllowanceView | null;
  picking: PickingView | null;
}) {
  const router = useRouter();
  const [loading, startLoading] = useTransition();
  const [state, action, pending] = useActionState(startTournamentAction, { error: null });
  const firstPlayable = scopes.find((s) => s.sizes) ?? scopes[0];
  const [selected, setSelected] = useState(picking?.scope ?? (firstPlayable ? scopeValue(firstPlayable) : ""));
  const scope = scopes.find((s) => scopeValue(s) === selected);
  const [size, setSize] = useState(String(scope?.sizes?.default ?? ""));
  const [unrated, setUnrated] = useState(false);
  const [handPicked, setHandPicked] = useState(picking !== null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [filter, setFilter] = useState("");

  function loadPicking(next: string | null) {
    startLoading(() => router.replace(next ? `/tournaments/new?pick=${encodeURIComponent(next)}` : "/tournaments/new", { scroll: false }));
  }

  function choose(next: ScopeOption) {
    setSelected(scopeValue(next));
    setSize(String(next.sizes?.default ?? ""));
    setPicked(new Set());
    setFilter("");
    if (handPicked) loadPicking(scopeValue(next));
  }

  function chooseHandPicked(next: boolean) {
    setHandPicked(next);
    loadPicking(next ? selected : null);
  }

  function toggle(id: string, on: boolean) {
    const next = new Set(picked);
    if (on) next.add(id);
    else next.delete(id);
    setPicked(next);
  }

  const contestants = handPicked && picking?.scope === selected ? picking.contestants : null;
  const sizeNumber = handPicked ? picked.size : Number(size);
  const validSize = handPicked
    ? contestants !== null && picked.size >= MIN_TOURNAMENT_SIZE
    : scope?.sizes && Number.isInteger(sizeNumber) && sizeNumber >= scope.sizes.min && sizeNumber <= scope.sizes.max;
  const remainingAllowance = (scope && allowance?.remaining[scopeValue(scope)]?.remaining) ?? 0;
  const status = validSize
    ? tournamentRatedStatus({
        signedIn: allowance !== null,
        choseUnrated: unrated,
        handPicked,
        hasUnfinishedRatedTournament: allowance?.hasUnfinishedRatedTournament ?? false,
        size: sizeNumber,
        remainingAllowance,
      })
    : null;
  const query = filter.trim().toLocaleLowerCase();

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
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">Contestants</legend>
          <div className="flex gap-2">
            {[
              { value: false, label: "Random draw" },
              { value: true, label: "Pick contestants" },
            ].map((option) => (
              <label
                key={option.label}
                className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border bg-white px-4 py-3 has-[:checked]:border-zinc-900 has-[:checked]:ring-1 has-[:checked]:ring-zinc-900"
              >
                <input
                  type="radio"
                  name="mode"
                  value={option.value ? "pick" : "draw"}
                  checked={handPicked === option.value}
                  onChange={() => chooseHandPicked(option.value)}
                  className="accent-zinc-900"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {scope?.sizes && !handPicked && (
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

      {scope?.sizes && handPicked && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-600">
            {picked.size} picked. Pick at least {MIN_TOURNAMENT_SIZE}; they&apos;re placed in the bracket at random.
          </p>
          {contestants === null ? (
            <p className="text-sm text-zinc-500">{loading ? "Loading contestants…" : "Couldn't load the contestants."}</p>
          ) : (
            <>
              <input
                type="search"
                aria-label="Find a contestant"
                placeholder="Find a contestant"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2"
              />
              <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2">
                {contestants.map((c) => (
                  <li key={c.id} hidden={query !== "" && !c.name.toLocaleLowerCase().includes(query)}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        name="contestant"
                        value={c.id}
                        aria-label={c.name}
                        checked={picked.has(c.id)}
                        onChange={(e) => toggle(c.id, e.target.checked)}
                        className="size-5 accent-zinc-900"
                      />
                      <Image src={c.picture128Url} alt="" width={128} height={128} className="size-8 rounded-md object-cover" />
                      <span>{c.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {allowance && !handPicked && (
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
          <input type="hidden" name="play" value={status.rated ? "rated" : "unrated"} />
        </div>
      )}

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-800">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={!scope?.sizes || (handPicked && !validSize) || pending}
        className="rounded-xl bg-zinc-900 px-4 py-3 text-lg font-medium text-white disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start tournament"}
      </button>
    </form>
  );
}
