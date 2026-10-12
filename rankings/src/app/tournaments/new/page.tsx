import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPerson } from "@/lib/session";
import { getAllowanceStatus, listScopeContestants, listTournamentScopes, listUnfinishedTournaments } from "@/server/game";
import { UnfinishedTournaments } from "../../unfinished-tournaments";
import { NewTournamentForm, type AllowanceView, type PickingView } from "./new-tournament-form";

export const metadata: Metadata = { title: "New tournament" };

export default async function NewTournamentPage({ searchParams }: PageProps<"/tournaments/new">) {
  const { pick } = await searchParams;
  const db = createAdminClient();
  const person = await readPerson();
  const now = new Date();
  const [scopes, unfinished, status] = await Promise.all([
    listTournamentScopes(db),
    person ? listUnfinishedTournaments(db, person) : [],
    person && "playerId" in person ? getAllowanceStatus(db, person, { now }) : null,
  ]);
  const pickScope = scopes.find((s) => s.sizes && (s.categoryId ?? "all") === pick);
  const picking: PickingView | null = pickScope
    ? { scope: pick as string, contestants: await listScopeContestants(db, pickScope.categoryId) }
    : null;
  const allowance: AllowanceView | null = status && {
    resetsAt: status.resetsAt,
    renderedAt: now.toISOString(),
    hasUnfinishedRatedTournament: status.hasUnfinishedRatedTournament,
    remaining: Object.fromEntries(
      status.scopes.map((s) => [s.categoryId ?? "all", { allowance: s.allowance, remaining: s.remaining }]),
    ),
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Second Quint Rankings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New tournament</h1>
      </header>

      <UnfinishedTournaments tournaments={unfinished} />

      <NewTournamentForm scopes={scopes} allowance={allowance} picking={picking} />
    </main>
  );
}
