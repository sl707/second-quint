"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { tournamentRatedStatus, unratedReasonMessage } from "@/domain/allowance/rated-status";
import { MIN_TOURNAMENT_SIZE } from "@/domain/tournament/size";
import type { ContestantCard, ScopeOption } from "@/server/game";
import { startTournamentAction } from "../actions";
import { AllowanceCountdown } from "../../allowance-countdown";
import { Button } from "../../ui/button";
import { ContestantThumb } from "../../ui/contestant-image";
import { CheckboxRow, Field, inputClass, optionClass } from "../../ui/field";
import { eyebrowClass } from "../../ui/frame";
import { Alert, plateClass } from "../../ui/plate";

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
        <p className="text-sm text-muted">
          Rated allowance resets at midnight Eastern, in{" "}
          <span className="font-semibold text-orange-bright tabular-nums">
            <AllowanceCountdown resetsAt={allowance.resetsAt} renderedAt={allowance.renderedAt} />
          </span>
          .
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className={`mb-2 ${eyebrowClass}`}>Scope</legend>
        {scopes.map((s) => {
          const left = allowance?.remaining[scopeValue(s)];
          return (
            <label
              key={scopeValue(s)}
              className={s.sizes ? optionClass : "flex items-center gap-3 border-2 border-dashed border-edge px-4 py-3 text-zinc-400"}
            >
              <input
                type="radio"
                name="scope"
                value={scopeValue(s)}
                checked={selected === scopeValue(s)}
                disabled={!s.sizes}
                onChange={() => choose(s)}
                className="size-5 shrink-0 accent-pink"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-display text-lg tracking-wide uppercase">{s.name}</span>
                {left && (
                  <span className="text-xs text-muted">
                    {left.remaining} of {left.allowance} rated matches left today
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right text-[13px] text-muted">
                {s.sizes ? `${s.contestantCount} contestants` : `${s.contestantCount} of 4 needed`}
              </span>
            </label>
          );
        })}
      </fieldset>

      {scope?.sizes && (
        <fieldset className="flex flex-col gap-2">
          <legend className={`mb-2 ${eyebrowClass}`}>Contestants</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: false, label: "Random draw" },
              { value: true, label: "Pick contestants" },
            ].map((option) => (
              <label key={option.label} className={`${optionClass} font-semibold`}>
                <input
                  type="radio"
                  name="mode"
                  value={option.value ? "pick" : "draw"}
                  checked={handPicked === option.value}
                  onChange={() => chooseHandPicked(option.value)}
                  className="size-5 shrink-0 accent-pink"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {scope?.sizes && !handPicked && (
        <Field label="Size" hint={`From ${scope.sizes.min} to ${scope.sizes.max} contestants, drawn at random.`}>
          <input
            type="number"
            name="size"
            inputMode="numeric"
            min={scope.sizes.min}
            max={scope.sizes.max}
            required
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className={`${inputClass} font-display text-2xl tabular-nums`}
          />
        </Field>
      )}

      {scope?.sizes && handPicked && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            <span className="font-display text-lg text-orange-bright">{picked.size} picked.</span> Pick at least{" "}
            {MIN_TOURNAMENT_SIZE}; they&apos;re placed in the bracket at random.
          </p>
          {contestants === null ? (
            <p className="text-sm text-muted">{loading ? "Loading contestants…" : "Couldn't load the contestants."}</p>
          ) : (
            <>
              <input
                type="search"
                aria-label="Find a contestant"
                placeholder="Find a contestant"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={inputClass}
              />
              <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto border-2 border-edge bg-plate p-2">
                {contestants.map((c) => (
                  <li key={c.id} hidden={query !== "" && !c.name.toLocaleLowerCase().includes(query)}>
                    <label className="flex cursor-pointer items-center gap-3 px-2 py-1.5 hover:bg-raised has-checked:bg-raised">
                      <input
                        type="checkbox"
                        name="contestant"
                        value={c.id}
                        aria-label={c.name}
                        checked={picked.has(c.id)}
                        onChange={(e) => toggle(c.id, e.target.checked)}
                        className="size-5 shrink-0 accent-pink"
                      />
                      <ContestantThumb src={c.picture128Url} size="sm" />
                      <span className="font-semibold">{c.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {allowance && !handPicked && (
        <CheckboxRow name="unrated" checked={unrated} onChange={(e) => setUnrated(e.target.checked)}>
          Play unrated
        </CheckboxRow>
      )}

      {status && (
        <div role="status" className={plateClass(status.rated ? "accent" : "default", "flex flex-col gap-1 px-4 py-3")}>
          <p className="flex items-center gap-2 font-display text-lg tracking-wide uppercase">
            {status.rated ? "This tournament will be rated." : "This tournament will be unrated."}
          </p>
          <p className="text-sm text-muted">
            {status.rated
              ? `Starting reserves all ${sizeNumber} of its matches from today's rated allowance, even if you don't finish.`
              : unratedReasonMessage(status.reason, { size: sizeNumber, remainingAllowance })}
          </p>
          <input type="hidden" name="play" value={status.rated ? "rated" : "unrated"} />
        </div>
      )}

      {state.error && <Alert>{state.error}</Alert>}

      <Button size="lg" disabled={!scope?.sizes || (handPicked && !validSize) || pending}>
        <span aria-hidden>▶ </span>
        {pending ? "Starting…" : "Start tournament"}
      </Button>
    </form>
  );
}
