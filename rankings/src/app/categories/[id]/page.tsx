import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCategory } from "@/server/catalog";
import { AddedBy } from "../../added-by";
import { deleteCategoryAction, removeFromCategoryAction } from "../../admin/actions";
import { ReportForm } from "../../report-form";
import { setCoverAction } from "../actions";
import { CategoryForm } from "../category-form";
import { AddContestants } from "./add-contestants";

const loadCategory = cache(async (id: string) => getCategory(createAdminClient(), id, await readSignedInPlayer()));

const sectionHeading = "text-sm font-medium uppercase tracking-wide text-zinc-500";

export async function generateMetadata({ params }: PageProps<"/categories/[id]">): Promise<Metadata> {
  return { title: (await loadCategory((await params).id))?.name ?? "Category not found" };
}

export default async function CategoryPage({ params }: PageProps<"/categories/[id]">) {
  const category = await loadCategory((await params).id);
  if (!category) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-3">
        <Link href="/categories" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Categories
        </Link>
        <div className="flex items-center gap-4">
          {category.cover && (
            <Image
              src={category.cover.picture512Url}
              alt={`Cover: ${category.cover.name}`}
              width={512}
              height={512}
              className="size-24 rounded-2xl object-cover"
            />
          )}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{category.name}</h1>
            <AddedBy by={category.createdBy} />
          </div>
        </div>
        {category.description && <p className="text-zinc-700">{category.description}</p>}
        <div className="flex flex-wrap gap-2">
          <Link href="/tournaments/new" className="rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700">
            Play a tournament
          </Link>
          <Link
            href={`/rankings/categories/${category.id}`}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 font-medium hover:border-zinc-500"
          >
            See ranking
          </Link>
        </div>
      </header>

      <section aria-labelledby="contestants-heading" className="flex flex-col gap-2">
        <h2 id="contestants-heading" className={sectionHeading}>
          {category.contestants.length} contestants
        </h2>
        <ul aria-labelledby="contestants-heading" className="flex flex-col gap-2">
          {category.contestants.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2">
              <Image src={c.picture128Url} alt="" width={128} height={128} className="size-12 rounded-lg object-cover" />
              <Link href={`/contestants/${c.id}`} className="flex-1 font-medium hover:underline">
                {c.name}
              </Link>
              {category.chosenCoverId === c.id ? (
                <span className="text-sm text-zinc-500">Cover</span>
              ) : (
                category.canChooseCover && (
                  <form action={setCoverAction.bind(null, category.id, c.id)}>
                    <button type="submit" aria-label={`Make ${c.name} the cover`} className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100">
                      Make cover
                    </button>
                  </form>
                )
              )}
              {category.canModerate && (
                <form action={removeFromCategoryAction.bind(null, category.id, c.id)}>
                  <button
                    type="submit"
                    aria-label={`Remove ${c.name} from this category`}
                    className="rounded-lg px-2 py-1 text-sm text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {category.canChooseCover && category.chosenCoverId && (
          <form action={setCoverAction.bind(null, category.id, null)}>
            <button type="submit" className="text-sm text-zinc-600 underline">
              Use the top contestant as the cover
            </button>
          </form>
        )}
      </section>

      {category.canAddContestants ? (
        <section aria-labelledby="add-heading" className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-100/50 px-4 py-4">
          <h2 id="add-heading" className="font-medium">
            Add contestants
          </h2>
          <AddContestants categoryId={category.id} memberIds={category.contestants.map((c) => c.id)} />
          <Link href={`/contestants/new?category=${category.id}`} className="self-start text-sm font-medium underline">
            Add a new contestant
          </Link>
        </section>
      ) : (
        <p className="text-sm text-zinc-600">Sign in to add contestants to this category.</p>
      )}

      {category.canEdit && (
        <details className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <summary className="cursor-pointer font-medium">Edit category</summary>
          <div className="pt-4">
            <CategoryForm category={{ id: category.id, name: category.name, description: category.description }} />
          </div>
        </details>
      )}

      {category.canModerate && (
        <details className="rounded-xl border border-red-200 bg-white px-4 py-3">
          <summary className="cursor-pointer font-medium text-red-800">Delete category</summary>
          <form action={deleteCategoryAction.bind(null, category.id)} className="flex flex-col gap-3 pt-3">
            <p className="text-sm text-zinc-600">
              This deletes the category and its rankings, and ends its unfinished tournaments. Its contestants stay, and
              its matches still count toward the overall ranking.
            </p>
            <button type="submit" className="self-start rounded-xl bg-red-700 px-4 py-2 font-medium text-white">
              Delete {category.name}
            </button>
          </form>
        </details>
      )}

      <ReportForm targetType="category" targetId={category.id} label={category.name} />
    </main>
  );
}
