import type { Metadata } from "next";
import { createVisitorClient } from "@/lib/supabase/server";
import { getGlobalRanking } from "@/server/rankings";
import { RankingView } from "../ranking-view";

export const metadata: Metadata = { title: "Overall Ranking" };

export default async function OverallRankingPage() {
  const ranking = (await getGlobalRanking(await createVisitorClient(), null))!;
  return <RankingView ranking={ranking} kind="Overall Ranking" />;
}
