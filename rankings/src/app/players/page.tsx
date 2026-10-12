import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { createVisitorClient } from "@/lib/supabase/server";
import { searchPlayers } from "@/server/profiles";

export const metadata: Metadata = { title: "Find players" };

/** Player search by the start of a display name: `?q=<name>`. */
export default async function PlayersPage({ searchParams }: PageProps<"/players">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const players = query ? await searchPlayers(await createVisitorClient(), query) : [];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Find players</h1>
        <p className="text-zinc-600">Search by the start of a display name.</p>
      </header>

      <Form action="/players" role="search" className="flex gap-2">
        <label className="flex flex-1 flex-col">
          <span className="sr-only">Display name</span>
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Display name"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base"
          />
        </label>
        <button type="submit" className="rounded-xl bg-zinc-900 px-4 py-3 font-medium text-white">
          Search
        </button>
      </Form>

      {query &&
        (players.length > 0 ? (
          <ul aria-label="Players found" className="flex flex-col gap-2">
            {players.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/players/${encodeURIComponent(p.displayName)}`}
                  className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium hover:border-zinc-400"
                >
                  {p.displayName}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-600">No players found.</p>
        ))}
    </main>
  );
}
