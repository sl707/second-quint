import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createVisitorClient } from "@/lib/supabase/server";
import { getGlobalRanking } from "@/server/rankings";
import { RankingView } from "../../ranking-view";

export const metadata: Metadata = { title: "Category Ranking" };

export default async function CategoryRankingPage({ params }: PageProps<"/rankings/categories/[id]">) {
  const { id } = await params;
  const ranking = await getGlobalRanking(await createVisitorClient(), id).catch(() => null);
  if (!ranking) notFound();
  return <RankingView ranking={ranking} kind="Category Ranking" />;
}
