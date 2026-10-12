import type { Metadata } from "next";
import Link from "next/link";
import { createVisitorClient } from "@/lib/supabase/server";
import { listRankingScopes } from "@/server/rankings";
import { eyebrowClass, Page, PageHeader } from "../ui/frame";

export const metadata: Metadata = { title: "Rankings" };

const linkClass =
  "flex items-center justify-between gap-3 border-2 border-edge bg-plate px-4 py-3 font-display text-lg tracking-wide uppercase transition hover:border-pink hover:bg-raised";

export default async function RankingsPage() {
  const [overall, ...categories] = await listRankingScopes(await createVisitorClient());

  return (
    <Page>
      <PageHeader back={{ href: "/", label: "Second Quint Rankings" }} title="Rankings" neon>
        <p>Everyone&apos;s picks combined, ordered by Score.</p>
      </PageHeader>

      <Link href="/rankings/overall" className={`${linkClass} -skew-x-6 border-pink py-5 text-2xl shadow-[6px_6px_0_var(--color-pink)]`}>
        <span className="skew-x-6">{overall.name}</span>
        <span className="skew-x-6 font-sans text-[13px] font-semibold tracking-widest text-orange-bright">Every contestant</span>
      </Link>

      {categories.length > 0 && (
        <section aria-labelledby="category-rankings" className="flex flex-col gap-2">
          <h2 id="category-rankings" className={eyebrowClass}>
            Category Rankings
          </h2>
          <ul className="flex flex-col gap-2">
            {categories.map((c) => (
              <li key={c.categoryId}>
                <Link href={`/rankings/categories/${c.categoryId}`} className={linkClass}>
                  {c.name}
                  <span aria-hidden className="text-pink-bright">
                    ▶
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
