import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GameError,
  getInfinitePair,
  pickInfiniteWinner,
  skipInfinitePair,
  startTournament,
  type Person,
} from "@/server/game";
import { refreshGlobalRankings } from "@/server/rankings";
import { createCategory, newPlayer, newVisitor, recordMatch, removeTestData } from "./fixtures";

const db = createAdminClient();

afterAll(() => removeTestData(db));

async function matchesBy(person: Person) {
  const owner = "playerId" in person ? { player_id: person.playerId } : { visitor_id: person.visitorId };
  const { data, error } = await db
    .from("matches")
    .select("winner_id, loser_id, category_id, rated, tournament_id")
    .match(owner)
    .order("id");
  if (error) throw error;
  return data;
}

describe("Infinite Mode picks", () => {
  it("stores each pick at once as an unrated match in the category it was drawn from", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 6);
    const visitor = newVisitor();

    const first = await getInfinitePair(db, visitor, categoryId);
    expect(first.contestants).toHaveLength(2);
    for (const c of first.contestants) expect(contestantIds).toContain(c.id);
    const [winner, loser] = first.contestants;
    await pickInfiniteWinner(db, visitor, { pairId: first.pairId, winnerId: winner.id });

    expect(await matchesBy(visitor)).toEqual([
      { winner_id: winner.id, loser_id: loser.id, category_id: categoryId, rated: false, tournament_id: null },
    ]);

    const second = await getInfinitePair(db, visitor, categoryId);
    expect(second.pairId).not.toBe(first.pairId);
    await pickInfiniteWinner(db, visitor, { pairId: second.pairId, winnerId: second.contestants[1].id });
    expect(await matchesBy(visitor)).toHaveLength(2);
  });

  it("stores picks from all contestants with no category, against the signed-in player", async () => {
    await createCategory(db, 2);
    const player = await newPlayer(db);

    const pair = await getInfinitePair(db, player, null);
    expect(pair.scopeName).toBe("All contestants");
    await pickInfiniteWinner(db, player, { pairId: pair.pairId, winnerId: pair.contestants[0].id });

    expect(await matchesBy(player)).toEqual([
      expect.objectContaining({ winner_id: pair.contestants[0].id, category_id: null, rated: false, tournament_id: null }),
    ]);
  });

  it("offers the same pair again until it's picked or skipped", async () => {
    const { categoryId } = await createCategory(db, 10);
    const visitor = newVisitor();

    const shown = await getInfinitePair(db, visitor, categoryId);
    expect(await getInfinitePair(db, visitor, categoryId)).toEqual(shown);
  });

  it("records a repeated tap on the same pair only once", async () => {
    const { categoryId } = await createCategory(db, 6);
    const visitor = newVisitor();
    const pair = await getInfinitePair(db, visitor, categoryId);

    await pickInfiniteWinner(db, visitor, { pairId: pair.pairId, winnerId: pair.contestants[0].id });
    await expect(pickInfiniteWinner(db, visitor, { pairId: pair.pairId, winnerId: pair.contestants[0].id })).rejects.toThrow(
      GameError,
    );
    expect(await matchesBy(visitor)).toHaveLength(1);
  });

  it("only accepts a winner from the pair shown, to the person it was shown to", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 6);
    const visitor = newVisitor();
    const pair = await getInfinitePair(db, visitor, categoryId);
    const outsider = contestantIds.find((id) => !pair.contestants.some((c) => c.id === id))!;

    await expect(pickInfiniteWinner(db, visitor, { pairId: pair.pairId, winnerId: outsider })).rejects.toThrow(GameError);
    await expect(pickInfiniteWinner(db, newVisitor(), { pairId: pair.pairId, winnerId: pair.contestants[0].id })).rejects.toThrow(
      GameError,
    );
    expect(await matchesBy(visitor)).toEqual([]);
    expect(await getInfinitePair(db, visitor, categoryId)).toEqual(pair);
  });

  it("draws pairs using the scope's latest global ratings and match counts", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 3);
    const [strong, weak] = contestantIds;
    for (let i = 0; i < 15; i++) await recordMatch(db, { winnerId: strong, loserId: weak, categoryId });
    await refreshGlobalRankings(db);
    const visitor = newVisitor();
    let seed = 11;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

    // Ignoring ratings, strong vs. weak would be a third of the pairs; they're far apart and well
    // matched, while the third contestant is new and sits between them.
    let strongVsWeak = 0;
    for (let i = 0; i < 30; i++) {
      const pair = await getInfinitePair(db, visitor, categoryId, { random });
      const ids = pair.contestants.map((c) => c.id);
      if (ids.includes(strong) && ids.includes(weak)) strongVsWeak++;
      await skipInfinitePair(db, visitor, { pairId: pair.pairId });
    }
    expect(strongVsWeak).toBeLessThanOrEqual(3);
  });

  it("needs a scope of at least 2 contestants", async () => {
    const { categoryId } = await createCategory(db, 1);
    await expect(getInfinitePair(db, newVisitor(), categoryId)).rejects.toThrow(GameError);
  });

  it("isn't blocked by an unfinished rated tournament", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    const { rated } = await startTournament(db, player, { categoryId, size: 4 });
    expect(rated).toBe(true);

    const pair = await getInfinitePair(db, player, categoryId);
    await pickInfiniteWinner(db, player, { pairId: pair.pairId, winnerId: pair.contestants[0].id });
    expect((await matchesBy(player)).filter((m) => m.tournament_id === null)).toHaveLength(1);
  });
});

describe("Infinite Mode skips", () => {
  it("pass on the pair without recording a match, as often as the person likes", async () => {
    const { categoryId } = await createCategory(db, 6);
    const visitor = newVisitor();

    let pair = await getInfinitePair(db, visitor, categoryId);
    for (let i = 0; i < 8; i++) {
      await skipInfinitePair(db, visitor, { pairId: pair.pairId });
      const next = await getInfinitePair(db, visitor, categoryId);
      expect(next.pairId).not.toBe(pair.pairId);
      pair = next;
    }

    expect(await matchesBy(visitor)).toEqual([]);
  });

  it("can't then pick the skipped pair", async () => {
    const { categoryId } = await createCategory(db, 6);
    const visitor = newVisitor();
    const pair = await getInfinitePair(db, visitor, categoryId);

    await skipInfinitePair(db, visitor, { pairId: pair.pairId });
    await expect(pickInfiniteWinner(db, visitor, { pairId: pair.pairId, winnerId: pair.contestants[0].id })).rejects.toThrow(
      GameError,
    );
    expect(await matchesBy(visitor)).toEqual([]);
  });
});
