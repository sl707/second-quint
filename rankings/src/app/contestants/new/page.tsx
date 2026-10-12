import type { Metadata } from "next";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCategory } from "@/server/catalog";
import { Page, PageHeader } from "../../ui/frame";
import { Notice } from "../../ui/plate";
import { ContestantForm } from "../contestant-form";

export const metadata: Metadata = { title: "Add a contestant" };

export default async function NewContestantPage({ searchParams }: PageProps<"/contestants/new">) {
  const { category } = await searchParams;
  const player = await readSignedInPlayer();
  const into = typeof category === "string" ? await getCategory(createAdminClient(), category) : null;

  return (
    <Page>
      <PageHeader back={into ? { href: `/categories/${into.id}`, label: into.name } : { href: "/categories", label: "Categories" }} title="Add a contestant">
        {into && <p>It will be added to {into.name}.</p>}
      </PageHeader>
      {player ? <ContestantForm mode={{ kind: "add", categoryId: into?.id ?? null }} /> : <Notice>Sign in with Google to add contestants.</Notice>}
    </Page>
  );
}
