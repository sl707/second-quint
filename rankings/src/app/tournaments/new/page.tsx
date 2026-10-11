import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { readVisitor } from "@/lib/visitor";
import { listTournamentScopes, listUnfinishedTournaments } from "@/server/game";
import { NewTournamentForm } from "./new-tournament-form";

export const metadata: Metadata = { title: "New tournament" };

export default async function NewTournamentPage() {
  const db = createAdminClient();
  const visitor = await readVisitor();
  const [scopes, unfinished] = await Promise.all([
    listTournamentScopes(db),
    visitor ? listUnfinishedTournaments(db, visitor) : [],
  ]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Second Quint Rankings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New tournament</h1>
      </header>

      {unfinished.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="unfinished-heading">
          <h2 id="unfinished-heading" className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Unfinished tournaments
          </h2>
          <ul className="flex flex-col gap-2">
            {unfinished.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tournaments/${t.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400"
                >
                  <span>
                    <span className="font-medium">{t.scopeName}</span>
                    <span className="text-zinc-500"> · {t.size} contestants</span>
                  </span>
                  <span className="text-sm text-zinc-600">
                    Resume · {t.matchesLeft} left
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NewTournamentForm scopes={scopes} />
    </main>
  );
}
