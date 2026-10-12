import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCategories } from "@/server/catalog";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const [categories, player] = await Promise.all([listCategories(createAdminClient()), readSignedInPlayer()]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Second Quint Rankings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
      </header>

      {player && (
        <div className="flex flex-wrap gap-2">
          <Link href="/categories/new" className="rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700">
            Create a category
          </Link>
          <Link href="/contestants/new" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 font-medium hover:border-zinc-500">
            Add a contestant
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={`/categories/${c.id}`}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 hover:border-zinc-400"
            >
              {c.cover ? (
                <Image src={c.cover.picture128Url} alt="" width={128} height={128} className="size-14 rounded-lg object-cover" />
              ) : (
                <span className="size-14 rounded-lg bg-zinc-100" />
              )}
              <span className="flex flex-1 flex-col">
                <span className="font-medium">{c.name}</span>
                <span className="line-clamp-1 text-sm text-zinc-500">{c.description}</span>
              </span>
              <span className="text-sm text-zinc-500">{c.contestantCount}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
