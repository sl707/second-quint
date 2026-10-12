import type { Metadata } from "next";
import Link from "next/link";
import { createVisitorClient } from "@/lib/supabase/server";
import { listRankingScopes } from "@/server/rankings";

export const metadata: Metadata = { title: "Rankings" };

export default async function RankingsPage() {
  const [overall, ...categories] = await listRankingScopes(await createVisitorClient());
  const linkClass =
    "flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 font-medium hover:border-zinc-400";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Second Quint Rankings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Rankings</h1>
        <p className="text-zinc-600">Everyone&apos;s picks combined, ordered by Score.</p>
      </header>

      <Link href="/rankings/overall" className={linkClass}>
        {overall.name}
        <span className="text-sm font-normal text-zinc-500">Every contestant</span>
      </Link>

      {categories.length > 0 && (
        <section aria-labelledby="category-rankings" className="flex flex-col gap-2">
          <h2 id="category-rankings" className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Category Rankings
          </h2>
          <ul className="flex flex-col gap-2">
            {categories.map((c) => (
              <li key={c.categoryId}>
                <Link href={`/rankings/categories/${c.categoryId}`} className={linkClass}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
