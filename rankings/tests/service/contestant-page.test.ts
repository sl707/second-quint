import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { snapshotWeek } from "@/domain/ranking/snapshot-week";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getContestantRankings, refreshGlobalRankings } from "@/server/rankings";
import { createCategory, recordMatch, removeTestData } from "./fixtures";

const db = createAdminClient();
const anyone = createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
  auth: { persistSession: false },
});
const DAY = 24 * 60 * 60 * 1000;

afterAll(() => removeTestData(db));

async function addToCategory(categoryId: string, contestantId: string) {
  const { error } = await db.from("category_memberships").insert({ category_id: categoryId, contestant_id: contestantId });
  if (error) throw error;
}

describe("contestant rankings", () => {
  it("gives the score and rank in overall and each of its categories, by version", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 3);
    const [a, b, c] = contestantIds;
    await recordMatch(db, { winnerId: a, loserId: b, categoryId, rated: true });
    await recordMatch(db, { winnerId: a, loserId: c, categoryId, rated: true });
    await recordMatch(db, { winnerId: b, loserId: a, categoryId });
    await refreshGlobalRankings(db);

    const rated = await getContestantRankings(anyone, a, { rated: true });
    expect(rated?.scopes.map((s) => s.categoryId)).toEqual([null, categoryId]);
    const ratedCategory = rated!.scopes[1];
    expect(ratedCategory.entry).toMatchObject({ position: 1, wins: 2, losses: 0, matches: 2 });
    expect(ratedCategory.entry!.score).toBeCloseTo(ratedCategory.entry!.rating - ratedCategory.entry!.range, 6);
    expect(rated!.scopes[0].entry).toMatchObject({ wins: 2, losses: 0 });

    const unrated = await getContestantRankings(anyone, a, { rated: false });
    expect(unrated!.scopes[1].entry).toMatchObject({ wins: 2, losses: 1, matches: 3 });
  });

  it("is not yet judged in scopes where it has no matches", async () => {
    const first = await createCategory(db, 2);
    const second = await createCategory(db, 2);
    const [a, b] = first.contestantIds;
    await addToCategory(second.categoryId, a);
    await recordMatch(db, { winnerId: a, loserId: b, categoryId: first.categoryId, rated: true });
    await refreshGlobalRankings(db);

    const rankings = await getContestantRankings(anyone, a, { rated: true });
    const byScope = new Map(rankings!.scopes.map((s) => [s.categoryId, s]));
    expect(byScope.get(first.categoryId)?.entry).not.toBeNull();
    expect(byScope.get(second.categoryId)?.entry).toBeNull();
    expect(byScope.get(second.categoryId)?.refreshedAt).not.toBeNull();

    const {
      contestantIds: [loner],
    } = await createCategory(db, 1);
    await refreshGlobalRankings(db);
    expect((await getContestantRankings(anyone, loner, { rated: false }))!.scopes.map((s) => s.entry)).toEqual([null, null]);
  });

  it("gives the overall record and head-to-head results against the most frequent opponents first", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 4);
    const [a, b, c, d] = contestantIds;
    for (let i = 0; i < 3; i++) await recordMatch(db, { winnerId: a, loserId: b, categoryId, rated: true });
    await recordMatch(db, { winnerId: b, loserId: a, categoryId });
    await recordMatch(db, { winnerId: a, loserId: c, categoryId, rated: true });
    await recordMatch(db, { winnerId: d, loserId: a, categoryId: null });
    await recordMatch(db, { winnerId: d, loserId: a, categoryId: null, rated: true });
    await recordMatch(db, { winnerId: c, loserId: a, categoryId, excluded: true });

    const unrated = await getContestantRankings(anyone, a, { rated: false });
    expect(unrated?.record).toEqual({ wins: 4, losses: 3, matches: 7 });
    expect(unrated?.headToHead.map((h) => ({ id: h.opponent.id, wins: h.wins, losses: h.losses }))).toEqual([
      { id: b, wins: 3, losses: 1 },
      { id: d, wins: 0, losses: 2 },
      { id: c, wins: 1, losses: 0 },
    ]);
    expect(unrated?.headToHead[0].opponent.name).toMatch(/^Test /);

    const rated = await getContestantRankings(anyone, a, { rated: true });
    expect(rated?.record).toEqual({ wins: 4, losses: 1, matches: 5 });
    expect(rated?.headToHead.map((h) => [h.opponent.id, h.matches])).toEqual([
      [b, 3],
      [c, 1],
      [d, 1],
    ]);
  });

  it("draws its rating over time from one rated snapshot per scope per week", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const [a, b] = contestantIds;
    // Wednesday afternoon of the week before last, safely inside one New York week.
    const wednesday = new Date(`${snapshotWeek(new Date(Date.now() - 14 * DAY))}T16:00:00Z`);
    wednesday.setUTCDate(wednesday.getUTCDate() + 2);
    const firstWeek = snapshotWeek(wednesday);
    const nextWeek = new Date(wednesday.getTime() + 7 * DAY);

    for (let i = 0; i < 2; i++) await recordMatch(db, { winnerId: a, loserId: b, categoryId, rated: true, playedAt: wednesday });
    await refreshGlobalRankings(db, { now: wednesday });
    const ratingThen = (await getContestantRankings(anyone, a, { rated: true }))!.scopes[1].entry!.rating;

    for (let i = 0; i < 3; i++) await recordMatch(db, { winnerId: b, loserId: a, categoryId, rated: true, playedAt: wednesday });
    await refreshGlobalRankings(db, { now: new Date(wednesday.getTime() + 60 * 60 * 1000) });
    let history = (await getContestantRankings(anyone, a, { rated: false }))!.scopes[1].history;
    expect(history).toHaveLength(1);
    expect(history[0].week).toBe(firstWeek);
    expect(history[0].rating).toBeCloseTo(ratingThen, 2);

    await refreshGlobalRankings(db, { now: nextWeek });
    history = (await getContestantRankings(anyone, a, { rated: true }))!.scopes[1].history;
    expect(history.map((h) => h.week)).toEqual([firstWeek, snapshotWeek(nextWeek)]);
    expect(history[1].rating).toBeLessThan(history[0].rating);
    expect(history[1].range).toBeGreaterThan(0);

    const { error } = await anyone.rpc("store_rating_snapshot", {
      p_category_id: categoryId,
      p_week: snapshotWeek(new Date()),
      p_taken_at: new Date().toISOString(),
      p_entries: [],
    });
    expect(error).not.toBeNull();
  });

  it("takes no snapshot from unrated matches", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const [a, b] = contestantIds;
    await recordMatch(db, { winnerId: a, loserId: b, categoryId });
    await refreshGlobalRankings(db);

    const rankings = await getContestantRankings(anyone, a, { rated: false });
    expect(rankings!.scopes[1].entry).not.toBeNull();
    expect(rankings!.scopes[1].history).toEqual([]);
  });

  it("is null for a contestant that doesn't exist", async () => {
    expect(await getContestantRankings(anyone, "00000000-0000-0000-0000-000000000000", { rated: true })).toBeNull();
  });
});
