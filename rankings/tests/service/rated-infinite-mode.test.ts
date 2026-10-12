import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GameError,
  getAllowanceStatus,
  getInfinitePair,
  giveUpTournament,
  pickInfiniteWinner,
  type ScopeId,
  type SignedInPlayer,
  skipInfinitePair,
  startTournament,
} from "@/server/game";
import { createCategory, newPlayer, newVisitor, removeTestData } from "./fixtures";

const db = createAdminClient();

afterAll(() => removeTestData(db));

async function remainingAllowance(player: SignedInPlayer, categoryId: ScopeId, now?: Date) {
  const status = await getAllowanceStatus(db, player, { now });
  return status.scopes.find((s) => s.categoryId === categoryId)!.remaining;
}

/** Picks the first contestant of the offered pair and says whether the pick was rated. */
async function pickOnce(player: SignedInPlayer, categoryId: ScopeId, now?: Date) {
  const pair = await getInfinitePair(db, player, categoryId);
  return (await pickInfiniteWinner(db, player, { pairId: pair.pairId, winnerId: pair.contestants[0].id }, { now })).rated;
}

describe("Rated Infinite Mode picks", () => {
  it("are rated for a signed-in player and each uses one allowance in the scope", async () => {
    const { categoryId } = await createCategory(db, 6);
    const player = await newPlayer(db);

    const pair = await getInfinitePair(db, player, categoryId);
    const pick = await pickInfiniteWinner(db, player, { pairId: pair.pairId, winnerId: pair.contestants[0].id });

    expect(pick.rated).toBe(true);
    expect(await remainingAllowance(player, categoryId)).toBe(19);
  });

  it("switch to unrated once the allowance in the scope runs out, and are rated again the next day", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    const evening = new Date("2026-03-03T23:00:00-05:00");
    const nextMorning = new Date("2026-03-04T08:00:00-05:00");
    await startTournament(db, player, { categoryId, size: 16, now: evening });

    const picks: boolean[] = [];
    for (let i = 0; i < 6; i++) picks.push(await pickOnce(player, categoryId, evening));

    expect(picks).toEqual([true, true, true, true, false, false]);
    expect(await remainingAllowance(player, categoryId, evening)).toBe(0);
    expect(await pickOnce(player, categoryId, nextMorning)).toBe(true);
  });

  it("come with when the allowance resets, midnight in New York, for a signed-in player only", async () => {
    const { categoryId } = await createCategory(db, 6);
    const evening = new Date("2026-03-03T23:00:00-05:00");

    expect((await getInfinitePair(db, await newPlayer(db), categoryId, { now: evening })).allowanceResetsAt).toBe(
      new Date("2026-03-04T00:00:00-05:00").toISOString(),
    );
    expect((await getInfinitePair(db, newVisitor(), categoryId, { now: evening })).allowanceResetsAt).toBeNull();
  });

  it("are unrated and use no allowance when the player chose to play unrated", async () => {
    const { categoryId } = await createCategory(db, 6);
    const player = await newPlayer(db);

    const pair = await getInfinitePair(db, player, categoryId, { unrated: true });
    const pick = await pickInfiniteWinner(db, player, { pairId: pair.pairId, winnerId: pair.contestants[0].id });

    expect(pick.rated).toBe(false);
    expect(await remainingAllowance(player, categoryId)).toBe(20);
  });

  it("never take the allowance past its size when a rated tournament starts at the same moment", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    const { tournamentId } = await startTournament(db, player, { categoryId, size: 16 });
    await giveUpTournament(db, player, tournamentId);
    const pair = await getInfinitePair(db, player, categoryId);

    const [pick, tournament] = await Promise.all([
      pickInfiniteWinner(db, player, { pairId: pair.pairId, winnerId: pair.contestants[0].id }),
      startTournament(db, player, { categoryId, size: 4 }),
    ]);

    expect([pick.rated, tournament.rated].filter(Boolean)).toHaveLength(1);
    expect(await remainingAllowance(player, categoryId)).toBe(pick.rated ? 3 : 0);
  });
});

/** Skips the offered pair `times` times. */
async function skipTimes(player: SignedInPlayer, categoryId: ScopeId, times: number, options: { now?: Date; unrated?: boolean } = {}) {
  for (let i = 0; i < times; i++) {
    const pair = await getInfinitePair(db, player, categoryId, { unrated: options.unrated, now: options.now });
    await skipInfinitePair(db, player, { pairId: pair.pairId }, { now: options.now });
  }
}

describe("Rated Infinite Mode skips", () => {
  it("are limited to 5 a day across all Infinite Mode, after which the rated pair must be picked", async () => {
    const [first, second] = [await createCategory(db, 6), await createCategory(db, 6)];
    const player = await newPlayer(db);
    const evening = new Date("2026-03-03T23:00:00-05:00");

    await skipTimes(player, first.categoryId, 3, { now: evening });
    await skipTimes(player, second.categoryId, 2, { now: evening });
    const stuck = await getInfinitePair(db, player, second.categoryId, { now: evening });

    await expect(skipInfinitePair(db, player, { pairId: stuck.pairId }, { now: evening })).rejects.toThrow(GameError);
    expect(await getInfinitePair(db, player, second.categoryId, { now: evening })).toEqual(stuck);
    const pick = await pickInfiniteWinner(db, player, { pairId: stuck.pairId, winnerId: stuck.contestants[0].id }, { now: evening });
    expect(pick.rated).toBe(true);
  });

  it("come back the next day in New York", async () => {
    const { categoryId } = await createCategory(db, 6);
    const player = await newPlayer(db);

    await skipTimes(player, categoryId, 5, { now: new Date("2026-03-03T23:00:00-05:00") });
    await skipTimes(player, categoryId, 5, { now: new Date("2026-03-04T00:30:00-05:00") });
  });

  it("are unlimited while the player chose to play unrated, without touching their rated skips", async () => {
    const { categoryId } = await createCategory(db, 6);
    const player = await newPlayer(db);

    await skipTimes(player, categoryId, 8, { unrated: true });
    await skipTimes(player, categoryId, 5);
  });

  it("are unlimited once the allowance in the scope runs out, since picks are unrated then", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    await startTournament(db, player, { categoryId, size: 20 });

    await skipTimes(player, categoryId, 8);
  });
});

describe("Infinite Mode play status", () => {
  it("shows a rated player their rated picks and skips left today", async () => {
    const { categoryId } = await createCategory(db, 6);
    const player = await newPlayer(db);
    await pickOnce(player, categoryId);
    await skipTimes(player, categoryId, 2);

    expect((await getInfinitePair(db, player, categoryId)).play).toEqual({ rated: true, ratedPicksLeft: 19, ratedSkipsLeft: 3 });
  });

  it("tells the player why picks are unrated", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    await startTournament(db, player, { categoryId, size: 20 });

    expect((await getInfinitePair(db, player, categoryId)).play).toEqual({ rated: false, reason: "allowance-used-up" });
    expect((await getInfinitePair(db, player, categoryId, { unrated: true })).play).toEqual({ rated: false, reason: "chose-unrated" });
    expect((await getInfinitePair(db, newVisitor(), categoryId)).play).toEqual({ rated: false, reason: "signed-out" });
  });
});
