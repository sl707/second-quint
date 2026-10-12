import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPerson } from "@/lib/session";
import { getAllowanceStatus, isSignedIn, listScopeContestants, listTournamentScopes, listUnfinishedTournaments } from "@/server/game";
import { UnfinishedTournaments } from "../../unfinished-tournaments";
import { Page, PageHeader } from "../../ui/frame";
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
    person && isSignedIn(person) ? getAllowanceStatus(db, person, { now }) : null,
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
    <Page>
      <PageHeader back={{ href: "/", label: "Second Quint Rankings" }} title="New tournament" neon>
        <p>Pick a scope and a size; every match is one pick between two contestants.</p>
      </PageHeader>

      <UnfinishedTournaments tournaments={unfinished} />

      <NewTournamentForm scopes={scopes} allowance={allowance} picking={picking} />
    </Page>
  );
}
