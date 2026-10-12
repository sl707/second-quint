import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { createVisitorClient } from "@/lib/supabase/server";
import { searchPlayers } from "@/server/profiles";
import { Button } from "../ui/button";
import { inputClass } from "../ui/field";
import { Page, PageHeader } from "../ui/frame";
import { Notice } from "../ui/plate";

export const metadata: Metadata = { title: "Find players" };

/** Player search by the start of a display name: `?q=<name>`. */
export default async function PlayersPage({ searchParams }: PageProps<"/players">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const players = query ? await searchPlayers(await createVisitorClient(), query) : [];

  return (
    <Page>
      <PageHeader title="Find players" neon>
        <p>Search by the start of a display name.</p>
      </PageHeader>

      <Form action="/players" role="search" className="flex items-center gap-3">
        <label className="flex min-w-0 flex-1 flex-col">
          <span className="sr-only">Display name</span>
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Display name"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={inputClass}
          />
        </label>
        <Button className="shrink-0">Search</Button>
      </Form>

      {query &&
        (players.length > 0 ? (
          <ul aria-label="Players found" className="flex flex-col gap-2">
            {players.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/players/${encodeURIComponent(p.displayName)}`}
                  className="flex items-center justify-between gap-3 border-2 border-edge bg-plate px-4 py-3 font-semibold transition hover:border-pink hover:bg-raised"
                >
                  {p.displayName}
                  <span aria-hidden className="text-pink-bright">
                    ▶
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Notice>No players found.</Notice>
        ))}
    </Page>
  );
}
