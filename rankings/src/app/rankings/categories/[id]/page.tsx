import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createVisitorClient } from "@/lib/supabase/server";
import { getGlobalRanking } from "@/server/rankings";
import { isRatedVersion, RankingView } from "../../ranking-view";

export const metadata: Metadata = { title: "Category Ranking" };

export default async function CategoryRankingPage({ params, searchParams }: PageProps<"/rankings/categories/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const ranking = await getGlobalRanking(await createVisitorClient(), id, { rated: isRatedVersion(query) }).catch(() => null);
  if (!ranking) notFound();
  return <RankingView ranking={ranking} kind="Category Ranking" path={`/rankings/categories/${id}`} />;
}
