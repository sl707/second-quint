import type { Metadata } from "next";
import { readSignedInPlayer } from "@/lib/session";
import { Page, PageHeader } from "../../ui/frame";
import { Notice } from "../../ui/plate";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "Create a category" };

export default async function NewCategoryPage() {
  const player = await readSignedInPlayer();

  return (
    <Page>
      <PageHeader back={{ href: "/categories", label: "Categories" }} title="Create a category" />
      {player ? <CategoryForm /> : <Notice>Sign in with Google to create categories.</Notice>}
    </Page>
  );
}
