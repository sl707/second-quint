import type { Metadata } from "next";
import { createVisitorClient } from "@/lib/supabase/server";
import { getGlobalRanking } from "@/server/rankings";
import { isRatedVersion, RankingView } from "../ranking-view";

export const metadata: Metadata = { title: "Overall Ranking" };

export default async function OverallRankingPage({ searchParams }: PageProps<"/rankings/overall">) {
  const rated = isRatedVersion(await searchParams);
  const ranking = (await getGlobalRanking(await createVisitorClient(), null, { rated }))!;
  return <RankingView ranking={ranking} kind="Overall Ranking" path="/rankings/overall" />;
}
