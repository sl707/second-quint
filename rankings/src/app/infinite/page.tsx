import type { Metadata } from "next";
import { RATED_SKIPS_PER_DAY } from "@/domain/allowance/allowance";
import { INFINITE_MODE_MIN_SCOPE } from "@/domain/infinite/pairing";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSignedInPlayer } from "@/lib/session";
import { getAllowanceStatus, listTournamentScopes } from "@/server/game";
import { CheckboxRow } from "../ui/field";
import { eyebrowClass, Page, PageHeader } from "../ui/frame";
import { startInfiniteModeAction } from "./actions";

export const metadata: Metadata = { title: "Infinite Mode" };

export default async function InfiniteModeScopesPage() {
  const db = createAdminClient();
  const player = await readSignedInPlayer();
  const [scopes, allowance] = await Promise.all([listTournamentScopes(db), player ? getAllowanceStatus(db, player) : null]);
  const left = new Map(allowance?.scopes.map((s) => [s.categoryId, s]));

  return (
    <Page>
      <PageHeader back={{ href: "/", label: "Second Quint Rankings" }} title="Infinite Mode" neon>
        <p className="text-base text-zinc-100">Pick the winner of one pair after another, for as long as you like.</p>
        {player && (
          <p>
            Your picks are rated while you have rated allowance left in the scope, then unrated. While rated, you get{" "}
            {RATED_SKIPS_PER_DAY} skips a day across all Infinite Mode.
          </p>
        )}
      </PageHeader>

      <form action={startInfiniteModeAction} className="flex flex-col gap-4">
        {player && <CheckboxRow name="unrated">Play unrated (skip as often as you like)</CheckboxRow>}

        <h2 className={eyebrowClass}>Choose a scope</h2>
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
                  className="flex w-full items-center justify-between gap-3 border-2 border-edge bg-plate px-4 py-3 text-left transition hover:border-pink hover:bg-raised disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent disabled:text-zinc-400"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-display text-lg tracking-wide uppercase">{s.name}</span>
                    {playable && scopeAllowance && (
                      <span className="text-xs text-muted">
                        {scopeAllowance.remaining} of {scopeAllowance.allowance} rated picks left today
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right text-[13px] text-muted">
                    {playable ? `${s.contestantCount} contestants` : "Needs at least 2 contestants"}
                    {playable && (
                      <span aria-hidden className="ml-2 font-display text-lg text-pink-bright">
                        ▶
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </form>
    </Page>
  );
}
