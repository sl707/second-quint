import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getContestant } from "@/server/catalog";
import { AddedBy } from "../../added-by";
import { deleteContestantAction } from "../actions";
import { ContestantForm } from "../contestant-form";

const loadContestant = cache(async (id: string) => getContestant(createAdminClient(), id, await readSignedInPlayer()));

export async function generateMetadata({ params }: PageProps<"/contestants/[id]">): Promise<Metadata> {
  return { title: (await loadContestant((await params).id))?.name ?? "Contestant not found" };
}

export default async function ContestantPage({ params }: PageProps<"/contestants/[id]">) {
  const contestant = await loadContestant((await params).id);
  if (!contestant) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Contestant</p>
        <Image
          src={contestant.picture512Url}
          alt={contestant.name}
          width={512}
          height={512}
          className="aspect-square w-full max-w-xs rounded-2xl object-cover"
        />
        <h1 className="text-3xl font-semibold tracking-tight">{contestant.name}</h1>
        <AddedBy by={contestant.createdBy} />
      </header>

      {contestant.categories.length > 0 && (
        <section aria-labelledby="categories-heading" className="flex flex-col gap-2">
          <h2 id="categories-heading" className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Categories
          </h2>
          <ul className="flex flex-wrap gap-2">
            {contestant.categories.map((c) => (
              <li key={c.id}>
                <Link href={`/categories/${c.id}`} className="block rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm hover:border-zinc-500">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {contestant.canEdit && (
        <>
          <details className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <summary className="cursor-pointer font-medium">Edit contestant</summary>
            <div className="pt-4">
              <ContestantForm
                mode={{ kind: "edit", contestant: { id: contestant.id, name: contestant.name, picture512Url: contestant.picture512Url } }}
              />
            </div>
          </details>
          <details className="rounded-xl border border-red-200 bg-white px-4 py-3">
            <summary className="cursor-pointer font-medium text-red-800">Delete contestant</summary>
            <form action={deleteContestantAction.bind(null, contestant.id)} className="flex flex-col gap-3 pt-3">
              <p className="text-sm text-zinc-600">
                This removes it from every category, along with every match and tournament it was in.
              </p>
              <button type="submit" className="self-start rounded-xl bg-red-700 px-4 py-2 font-medium text-white">
                Delete {contestant.name}
              </button>
            </form>
          </details>
        </>
      )}
    </main>
  );
}
