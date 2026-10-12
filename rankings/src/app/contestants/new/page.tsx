import type { Metadata } from "next";
import Link from "next/link";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCategory } from "@/server/catalog";
import { ContestantForm } from "../contestant-form";

export const metadata: Metadata = { title: "Add a contestant" };

export default async function NewContestantPage({ searchParams }: PageProps<"/contestants/new">) {
  const { category } = await searchParams;
  const player = await readSignedInPlayer();
  const into = typeof category === "string" ? await getCategory(createAdminClient(), category) : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href={into ? `/categories/${into.id}` : "/categories"} className="text-sm text-zinc-500 hover:text-zinc-800">
          ← {into ? into.name : "Categories"}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Add a contestant</h1>
        {into && <p className="text-zinc-600">It will be added to {into.name}.</p>}
      </header>
      {player ? (
        <ContestantForm mode={{ kind: "add", categoryId: into?.id ?? null }} />
      ) : (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-600">
          Sign in with Google to add contestants.
        </p>
      )}
    </main>
  );
}
