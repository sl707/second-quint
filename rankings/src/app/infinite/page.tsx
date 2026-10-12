import type { Metadata } from "next";
import Link from "next/link";
import { RATED_SKIPS_PER_DAY } from "@/domain/allowance/allowance";
import { INFINITE_MODE_MIN_SCOPE } from "@/domain/infinite/pairing";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSignedInPlayer } from "@/lib/session";
import { getAllowanceStatus, listTournamentScopes } from "@/server/game";
import { startInfiniteModeAction } from "./actions";

export const metadata: Metadata = { title: "Infinite Mode" };

export default async function InfiniteModeScopesPage() {
  const db = createAdminClient();
  const player = await readSignedInPlayer();
  const [scopes, allowance] = await Promise.all([listTournamentScopes(db), player ? getAllowanceStatus(db, player) : null]);
  const left = new Map(allowance?.scopes.map((s) => [s.categoryId, s]));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Second Quint Rankings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Infinite Mode</h1>
        <p className="text-zinc-600">Pick the winner of one pair after another, for as long as you like.</p>
        {player && (
          <p className="text-sm text-zinc-600">
            Your picks are rated while you have rated allowance left in the scope, then unrated. While rated, you get{" "}
            {RATED_SKIPS_PER_DAY} skips a day across all Infinite Mode.
          </p>
        )}
      </header>

      <form action={startInfiniteModeAction} className="flex flex-col gap-4">
        {player && (
          <label className="flex items-center gap-3">
            <input type="checkbox" name="unrated" className="size-5 accent-zinc-900" />
            <span>Play unrated (skip as often as you like)</span>
          </label>
        )}

        <ul aria-label="Scopes" className="flex flex-col gap-2">
          {scopes.map((s) => {
            const value = s.categoryId ?? "all";
            const playable = s.contestantCount >= INFINITE_MODE_MIN_SCOPE;
            const scopeAllowance = left.get(s.categoryId);
            return (
              <li key={value}>
                <button
                  type="submit"
                  name="scope"
                  value={value}
                  disabled={!playable}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left font-medium hover:border-zinc-400 disabled:opacity-50 disabled:hover:border-zinc-200"
                >
                  <span className="flex flex-col">
                    {s.name}
                    {playable && scopeAllowance && (
                      <span className="text-xs font-normal text-zinc-500">
                        {scopeAllowance.remaining} of {scopeAllowance.allowance} rated picks left today
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-normal text-zinc-500">
                    {playable ? `${s.contestantCount} contestants` : "Needs at least 2 contestants"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </form>
    </main>
  );
}
