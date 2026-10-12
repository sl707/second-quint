import type { Metadata } from "next";
import Link from "next/link";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCategories } from "@/server/catalog";
import { ButtonLink } from "../ui/button";
import { ContestantThumb } from "../ui/contestant-image";
import { Page, PageHeader } from "../ui/frame";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const [categories, player] = await Promise.all([listCategories(createAdminClient()), readSignedInPlayer()]);

  return (
    <Page>
      <PageHeader back={{ href: "/", label: "Second Quint Rankings" }} title="Categories" neon />

      {player && (
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/categories/new">Create a category</ButtonLink>
          <ButtonLink href="/contestants/new" variant="secondary">
            Add a contestant
          </ButtonLink>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={`/categories/${c.id}`}
              className="flex items-center gap-3 border-2 border-edge bg-plate px-3 py-2 transition hover:border-pink hover:bg-raised"
            >
              {c.cover ? (
                <ContestantThumb src={c.cover.picture128Url} size="lg" />
              ) : (
                <span aria-hidden className="size-14 shrink-0 -skew-x-6 border-2 border-dashed border-edge" />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-display text-lg tracking-wide uppercase">{c.name}</span>
                <span className="line-clamp-1 text-[13px] text-muted">{c.description}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-display text-xl leading-none text-orange-bright tabular-nums">{c.contestantCount}</span>
                <span className="block text-xs text-muted">contestants</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
