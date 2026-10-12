import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GameError,
  getAllowanceStatus,
  getTournament,
  giveUpTournament,
  listUnfinishedTournaments,
  pickWinner,
  startTournament,
  undoLastPick,
  type Person,
} from "@/server/game";
import { createCategory, newPlayer, newVisitor, removeTestData } from "./fixtures";

const db = createAdminClient();

afterAll(() => removeTestData(db));

async function allowanceIn(player: { playerId: string }, categoryId: string | null, now?: Date) {
  const status = await getAllowanceStatus(db, player, { now });
  return status.scopes.find((s) => s.categoryId === categoryId)!;
}

async function pickNext(person: Person, tournamentId: string) {
  const next = (await getTournament(db, person, tournamentId))!.bracket.next!;
  await pickWinner(db, person, tournamentId, next.contestantIds[0]);
}

async function tournamentMatches(tournamentId: string) {
  const { data } = await db.from("matches").select("rated").eq("tournament_id", tournamentId);
  return data!;
}

/** An instant given as New York wall-clock time in winter (EST, UTC−5). */
const newYorkWinter = (wallClock: string) => new Date(`${wallClock}-05:00`);

describe("the player's unfinished tournaments", () => {
  it("lists rated and unrated ones, saying which is rated", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    const rated = await startTournament(db, player, { categoryId, size: 4 });
    const unrated = await startTournament(db, player, { categoryId, size: 5, play: "unrated" });

    expect(await listUnfinishedTournaments(db, player)).toEqual([
      expect.objectContaining({ id: unrated.tournamentId, rated: false, matchesLeft: 5 }),
      expect.objectContaining({ id: rated.tournamentId, rated: true, matchesLeft: 4 }),
    ]);
  });
});

describe("resuming a rated tournament on a later day", () => {
  it("keeps its matches rated without using the new day's allowance", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    const { tournamentId } = await startTournament(db, player, { categoryId, size: 8, now: newYorkWinter("2026-01-14T22:00:00") });
    await pickNext(player, tournamentId);

    for (let i = 0; i < 7; i++) await pickNext(player, tournamentId);

    expect((await getTournament(db, player, tournamentId))?.status).toBe("finished");
    expect(await tournamentMatches(tournamentId)).toEqual(Array(8).fill({ rated: true }));
    expect(await allowanceIn(player, categoryId, newYorkWinter("2026-01-14T23:00:00"))).toMatchObject({ used: 8 });
    expect(await allowanceIn(player, categoryId, newYorkWinter("2026-01-15T09:00:00"))).toMatchObject({ used: 0, remaining: 20 });
  });
});

describe("an unfinished rated tournament", () => {
  it("never stops the player starting unrated tournaments", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    await startTournament(db, player, { categoryId, size: 4 });

    const unrated = await startTournament(db, player, { categoryId, size: 4, play: "unrated" });

    expect(unrated).toMatchObject({ rated: false, unratedReason: "chose-unrated" });
    expect(await listUnfinishedTournaments(db, player)).toHaveLength(2);
  });
});

describe("giving up a rated tournament", () => {
  it("ends it with its played matches still counted, no tournament ranking, and nothing refunded", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    const { tournamentId } = await startTournament(db, player, { categoryId, size: 8 });
    await pickNext(player, tournamentId);
    await pickNext(player, tournamentId);

    await giveUpTournament(db, player, tournamentId);

    const tournament = (await getTournament(db, player, tournamentId))!;
    expect(tournament.status).toBe("given_up");
    expect(tournament.bracket.ranking).toBeNull();
    expect(tournament.canUndo).toBe(false);
    expect(await tournamentMatches(tournamentId)).toEqual([{ rated: true }, { rated: true }]);
    expect(await allowanceIn(player, categoryId)).toMatchObject({ used: 8, remaining: 12 });
    expect(await listUnfinishedTournaments(db, player)).toEqual([]);
    await expect(pickNext(player, tournamentId)).rejects.toThrow(GameError);
    await expect(undoLastPick(db, player, tournamentId)).rejects.toThrow(GameError);
  });

  it("lets the player start another rated tournament, in any scope", async () => {
    const a = await createCategory(db, 20);
    const b = await createCategory(db, 20);
    const player = await newPlayer(db);
    const first = await startTournament(db, player, { categoryId: a.categoryId, size: 4 });
    expect(await startTournament(db, player, { categoryId: b.categoryId, size: 4 })).toMatchObject({ rated: false });

    await giveUpTournament(db, player, first.tournamentId);

    expect(await getAllowanceStatus(db, player)).toMatchObject({ hasUnfinishedRatedTournament: false });
    expect(await startTournament(db, player, { categoryId: b.categoryId, size: 4 })).toMatchObject({ rated: true });
  });

  it("is only for the player's own unfinished rated tournaments", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    const unrated = await startTournament(db, player, { categoryId, size: 4, play: "unrated" });
    const rated = await startTournament(db, player, { categoryId, size: 4 });

    await expect(giveUpTournament(db, player, unrated.tournamentId)).rejects.toThrow(GameError);
    await expect(giveUpTournament(db, await newPlayer(db), rated.tournamentId)).rejects.toThrow(GameError);
    await expect(giveUpTournament(db, newVisitor(), rated.tournamentId)).rejects.toThrow(GameError);
    for (let i = 0; i < 4; i++) await pickNext(player, rated.tournamentId);
    await expect(giveUpTournament(db, player, rated.tournamentId)).rejects.toThrow(GameError);
    expect((await getTournament(db, player, rated.tournamentId))?.status).toBe("finished");
  });
});
