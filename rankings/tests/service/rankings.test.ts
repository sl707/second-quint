import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInfinitePair, getTournament, pickInfiniteWinner, pickWinner, startTournament } from "@/server/game";
import { getGlobalRanking, refreshGlobalRankings, type GlobalRanking } from "@/server/rankings";
import { createCategory, newPlayer, newVerifiedVisitor, recordMatch, removeTestData } from "./fixtures";

const db = createAdminClient();
const anyone = createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
  auth: { persistSession: false },
});
const DAY = 24 * 60 * 60 * 1000;

afterAll(() => removeTestData(db));

describe("global rankings", () => {
  it("a match in a category feeds that category's ranking and the overall ranking", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 4);
    const [a, b, c, unjudged] = contestantIds;
    await recordMatch(db, { winnerId: a, loserId: b, categoryId });
    await recordMatch(db, { winnerId: a, loserId: c, categoryId });
    await recordMatch(db, { winnerId: b, loserId: c, categoryId });

    await refreshGlobalRankings(db);

    const category = await getGlobalRanking(db, categoryId, { rated: false });
    expect(category?.ranked.map((r) => r.contestant.id)).toEqual([a, b, c]);
    expect(category?.ranked[0]).toMatchObject({ position: 1, wins: 2, losses: 0, matches: 2 });
    expect(category?.notYetJudged.map((card) => card.id)).toEqual([unjudged]);

    const overall = await getGlobalRanking(db, null, { rated: false });
    expect(overall?.scopeName).toBe("Overall Ranking");
    const overallA = overall?.ranked.find((r) => r.contestant.id === a);
    expect(overallA).toMatchObject({ wins: 2, losses: 0 });
    expect(overallA?.score).toBeCloseTo(category!.ranked[0].score, 3);
    expect(overall?.notYetJudged.map((card) => card.id)).toContain(unjudged);
  });

  it("a match drawn from all contestants feeds only the overall ranking", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const [a, b] = contestantIds;
    await recordMatch(db, { winnerId: a, loserId: b, categoryId: null });

    await refreshGlobalRankings(db);

    const category = await getGlobalRanking(db, categoryId, { rated: false });
    expect(category?.ranked).toEqual([]);
    expect(category?.notYetJudged.map((card) => card.id).sort()).toEqual([a, b].sort());
    const overall = await getGlobalRanking(db, null, { rated: false });
    expect(overall?.ranked.find((r) => r.contestant.id === a)).toMatchObject({ wins: 1, losses: 0 });
    expect(overall?.ranked.find((r) => r.contestant.id === b)).toMatchObject({ wins: 0, losses: 1 });
  });

  it("favors recent matches", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const [oldFavorite, newFavorite] = contestantIds;
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      await recordMatch(db, { winnerId: oldFavorite, loserId: newFavorite, categoryId, playedAt: new Date(now.getTime() - (120 + i) * DAY) });
    }
    for (let i = 0; i < 4; i++) await recordMatch(db, { winnerId: newFavorite, loserId: oldFavorite, categoryId });

    await refreshGlobalRankings(db, { now });

    const ranking = await getGlobalRanking(db, categoryId, { rated: false });
    expect(ranking?.ranked.map((r) => r.contestant.id)).toEqual([newFavorite, oldFavorite]);
    expect(ranking?.ranked[1]).toMatchObject({ wins: 8, losses: 4, matches: 12 });
  });

  it("leaves out excluded matches", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const [a, b] = contestantIds;
    await recordMatch(db, { winnerId: a, loserId: b, categoryId, excluded: true });

    await refreshGlobalRankings(db);

    expect((await getGlobalRanking(db, categoryId, { rated: false }))?.ranked).toEqual([]);
  });

  it("each refresh replaces the stored lists", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const [a, b] = contestantIds;
    await recordMatch(db, { winnerId: a, loserId: b, categoryId });
    await refreshGlobalRankings(db, { now: new Date(Date.now() - 5 * 60 * 1000) });
    const before = await getGlobalRanking(db, categoryId, { rated: false });

    await recordMatch(db, { winnerId: b, loserId: a, categoryId });
    await recordMatch(db, { winnerId: b, loserId: a, categoryId });
    await refreshGlobalRankings(db);

    const after = await getGlobalRanking(db, categoryId, { rated: false });
    expect(new Date(after!.refreshedAt!).getTime()).toBeGreaterThan(new Date(before!.refreshedAt!).getTime());
    expect(after?.ranked.map((r) => r.contestant.id)).toEqual([b, a]);
    const { data: lists } = await db.from("ranking_lists").select("rated").eq("category_id", categoryId).order("rated");
    expect(lists).toEqual([{ rated: false }, { rated: true }]);
  });

  it("shows no list for a category the refresher hasn't reached yet", async () => {
    const { categoryId } = await createCategory(db, 2);

    expect(await getGlobalRanking(db, categoryId, { rated: false })).toMatchObject({ refreshedAt: null, ranked: [], notYetJudged: [] });
  });

  it("lets anyone read rankings but only the server store them", async () => {
    const { categoryId } = await createCategory(db, 2);
    await refreshGlobalRankings(db);

    expect((await getGlobalRanking(anyone, categoryId, { rated: false }))?.notYetJudged).toHaveLength(2);
    const { error } = await anyone.rpc("store_ranking_list", {
      p_category_id: categoryId,
      p_rated: false,
      p_refreshed_at: new Date().toISOString(),
      p_entries: [],
    });
    expect(error).not.toBeNull();
  });
});

describe("which rankings a match feeds", () => {
  const record = (ranking: GlobalRanking | null, contestantId: string) => {
    const row = ranking?.ranked.find((r) => r.contestant.id === contestantId);
    return row ? { wins: row.wins, losses: row.losses } : null;
  };
  const versions = [true, false];

  it("a rated pick feeds its category's and overall's rankings, rated and unrated", async () => {
    const { categoryId } = await createCategory(db, 2);
    const player = await newPlayer(db);
    const pair = await getInfinitePair(db, player, categoryId);
    const [winner, loser] = pair.contestants;
    expect(await pickInfiniteWinner(db, player, { pairId: pair.pairId, winnerId: winner.id })).toEqual({ rated: true });

    await refreshGlobalRankings(db);

    for (const scope of [categoryId, null]) {
      for (const rated of versions) {
        const ranking = await getGlobalRanking(db, scope, { rated });
        expect(ranking?.rated).toBe(rated);
        expect(record(ranking, winner.id)).toEqual({ wins: 1, losses: 0 });
        expect(record(ranking, loser.id)).toEqual({ wins: 0, losses: 1 });
      }
    }
  });

  it("a pick in an unfinished rated tournament counts in the rated rankings straight away", async () => {
    const { categoryId } = await createCategory(db, 4);
    const player = await newPlayer(db);
    const { tournamentId, rated } = await startTournament(db, player, { categoryId, size: 4 });
    expect(rated).toBe(true);
    const [winnerId, loserId] = (await getTournament(db, player, tournamentId))!.bracket.next!.contestantIds;
    await pickWinner(db, player, tournamentId, winnerId);

    await refreshGlobalRankings(db);

    for (const scope of [categoryId, null]) {
      const ranking = await getGlobalRanking(db, scope, { rated: true });
      expect(record(ranking, winnerId)).toEqual({ wins: 1, losses: 0 });
      expect(record(ranking, loserId)).toEqual({ wins: 0, losses: 1 });
    }
  });

  it("an unrated pick, like a signed-out visitor's, feeds only the unrated rankings", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const visitor = await newVerifiedVisitor(db);
    const pair = await getInfinitePair(db, visitor, categoryId);
    const [winner, loser] = pair.contestants;
    expect(await pickInfiniteWinner(db, visitor, { pairId: pair.pairId, winnerId: winner.id })).toEqual({ rated: false });

    await refreshGlobalRankings(db);

    for (const scope of [categoryId, null]) {
      const unrated = await getGlobalRanking(db, scope, { rated: false });
      expect(record(unrated, winner.id)).toEqual({ wins: 1, losses: 0 });
      expect(record(unrated, loser.id)).toEqual({ wins: 0, losses: 1 });

      const rated = await getGlobalRanking(db, scope, { rated: true });
      expect(record(rated, winner.id)).toBeNull();
      expect(record(rated, loser.id)).toBeNull();
      expect(rated?.notYetJudged.map((card) => card.id)).toEqual(expect.arrayContaining(contestantIds));
    }
    expect((await getGlobalRanking(db, categoryId, { rated: false }))?.notYetJudged).toEqual([]);
  });

  it("a rated match drawn from all contestants feeds only overall's rankings, rated and unrated", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const [a, b] = contestantIds;
    await recordMatch(db, { winnerId: a, loserId: b, categoryId: null, rated: true });

    await refreshGlobalRankings(db);

    for (const rated of versions) {
      expect((await getGlobalRanking(db, categoryId, { rated }))?.ranked).toEqual([]);
      expect(record(await getGlobalRanking(db, null, { rated }), a)).toEqual({ wins: 1, losses: 0 });
    }
  });
});
