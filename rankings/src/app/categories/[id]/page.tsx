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
import { Button, ButtonLink, inlineLinkClass, textActionClass } from "../../ui/button";
import { Chip } from "../../ui/chip";
import { ContestantThumb } from "../../ui/contestant-image";
import { Page, SectionTitle } from "../../ui/frame";
import { Disclosure, plateClass } from "../../ui/plate";
import { setCoverAction } from "../actions";
import { CategoryForm } from "../category-form";
import { AddContestants } from "./add-contestants";

const loadCategory = cache(async (id: string) => getCategory(createAdminClient(), id, await readSignedInPlayer()));

export async function generateMetadata({ params }: PageProps<"/categories/[id]">): Promise<Metadata> {
  return { title: (await loadCategory((await params).id))?.name ?? "Category not found" };
}

export default async function CategoryPage({ params }: PageProps<"/categories/[id]">) {
  const category = await loadCategory((await params).id);
  if (!category) notFound();

  return (
    <Page>
      <header className="flex flex-col gap-3">
        <Link href="/categories" className="self-start text-[13px] font-semibold tracking-[0.2em] text-muted uppercase hover:text-orange-bright">
          ← Categories
        </Link>
        <div className="flex items-center gap-4">
          {category.cover && (
            <Image
              src={category.cover.picture512Url}
              alt={`Cover: ${category.cover.name}`}
              width={512}
              height={512}
              className="size-24 shrink-0 -skew-x-6 border-4 border-white object-cover shadow-[6px_6px_0_var(--color-orange)]"
            />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[13px] font-semibold tracking-[0.2em] text-orange-bright uppercase">Category</p>
            <h1 className="font-display text-4xl leading-none uppercase italic [overflow-wrap:anywhere]">{category.name}</h1>
            <AddedBy by={category.createdBy} />
          </div>
        </div>
        {category.description && <p className="text-zinc-100">{category.description}</p>}
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/tournaments/new">
            <span aria-hidden>▶ </span>Play a tournament
          </ButtonLink>
          <ButtonLink href={`/rankings/categories/${category.id}`} variant="secondary">
            See ranking
          </ButtonLink>
        </div>
      </header>

      <section aria-labelledby="contestants-heading" className="flex flex-col gap-2">
        <SectionTitle id="contestants-heading">{category.contestants.length} contestants</SectionTitle>
        <ul aria-labelledby="contestants-heading" className="flex flex-col gap-1.5">
          {category.contestants.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-l-4 border-edge bg-plate px-3 py-2">
              <ContestantThumb src={c.picture128Url} />
              <Link href={`/contestants/${c.id}`} className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere] hover:text-orange-bright">
                {c.name}
              </Link>
              {category.chosenCoverId === c.id ? (
                <Chip tone="orange">Cover</Chip>
              ) : (
                category.canChooseCover && (
                  <form action={setCoverAction.bind(null, category.id, c.id)}>
                    <button type="submit" aria-label={`Make ${c.name} the cover`} className={textActionClass}>
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
                    className="text-sm font-semibold tracking-wider text-danger uppercase hover:underline"
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
            <button type="submit" className={inlineLinkClass}>
              Use the top contestant as the cover
            </button>
          </form>
        )}
      </section>

      {category.canAddContestants ? (
        <section aria-labelledby="add-heading" className={plateClass("accent", "flex flex-col gap-4 p-4")}>
          <SectionTitle id="add-heading" as="h3">
            Add contestants
          </SectionTitle>
          <AddContestants categoryId={category.id} memberIds={category.contestants.map((c) => c.id)} />
          <Link href={`/contestants/new?category=${category.id}`} className={`self-start ${inlineLinkClass}`}>
            Add a new contestant
          </Link>
        </section>
      ) : (
        <p className="text-sm text-muted">Sign in to add contestants to this category.</p>
      )}

      {category.canEdit && (
        <Disclosure summary="Edit category">
          <CategoryForm category={{ id: category.id, name: category.name, description: category.description }} />
        </Disclosure>
      )}

      {category.canModerate && (
        <Disclosure summary="Delete category" tone="danger">
          <form action={deleteCategoryAction.bind(null, category.id)} className="flex flex-col gap-3">
            <p className="text-sm text-zinc-100">
              This deletes the category and its rankings, and ends its unfinished tournaments. Its contestants stay, and
              its matches still count toward the overall ranking.
            </p>
            <Button variant="danger" className="self-start">
              Delete {category.name}
            </Button>
          </form>
        </Disclosure>
      )}

      <ReportForm targetType="category" targetId={category.id} label={category.name} />
    </Page>
  );
}
