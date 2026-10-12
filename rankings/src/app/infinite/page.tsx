import type { Metadata } from "next";
import Link from "next/link";
import { INFINITE_MODE_MIN_SCOPE } from "@/domain/infinite/pairing";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTournamentScopes } from "@/server/game";
import { startInfiniteModeAction } from "./actions";

export const metadata: Metadata = { title: "Infinite Mode" };

export default async function InfiniteModeScopesPage() {
  const scopes = await listTournamentScopes(createAdminClient());

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Second Quint Rankings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Infinite Mode</h1>
        <p className="text-zinc-600">Pick the winner of one pair after another, for as long as you like.</p>
      </header>

      <ul aria-label="Scopes" className="flex flex-col gap-2">
        {scopes.map((s) => {
          const value = s.categoryId ?? "all";
          const playable = s.contestantCount >= INFINITE_MODE_MIN_SCOPE;
          return (
            <li key={value}>
              <form action={startInfiniteModeAction.bind(null, value)}>
                <button
                  type="submit"
                  disabled={!playable}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left font-medium hover:border-zinc-400 disabled:opacity-50 disabled:hover:border-zinc-200"
                >
                  {s.name}
                  <span className="text-sm font-normal text-zinc-500">
                    {playable ? `${s.contestantCount} contestants` : "Needs at least 2 contestants"}
                  </span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
