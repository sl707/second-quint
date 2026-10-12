import type { Metadata } from "next";
import Link from "next/link";
import { readSignedInPlayer } from "@/lib/session";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "Create a category" };

export default async function NewCategoryPage() {
  const player = await readSignedInPlayer();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/categories" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Categories
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Create a category</h1>
      </header>
      {player ? (
        <CategoryForm />
      ) : (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-600">
          Sign in with Google to create categories.
        </p>
      )}
    </main>
  );
}
