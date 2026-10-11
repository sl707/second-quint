import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { GameError, getTournament, listTournamentScopes, listUnfinishedTournaments, pickWinner, startTournament, undoLastPick, type Visitor } from "@/server/game";
import { createCategory, newVisitor, removeTestData } from "./fixtures";

const db = createAdminClient();

afterAll(() => removeTestData(db));

describe("starting a tournament", () => {
  it("defaults to 16 contestants drawn from the category", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 20);
    const visitor = newVisitor();

    const { tournamentId } = await startTournament(db, visitor, { categoryId });
    const tournament = await getTournament(db, visitor, tournamentId);

    expect(tournament?.size).toBe(16);
    expect(tournament?.status).toBe("in_progress");
    const drawn = tournament!.bracket.rounds[0].flatMap((m) => m.contestantIds).filter((id) => id !== null);
    expect(drawn).toHaveLength(16);
    for (const id of drawn) expect(contestantIds).toContain(id);
  });

  it("defaults to the scope size when the category has fewer than 16, filling the bracket with byes", async () => {
    const { categoryId } = await createCategory(db, 6);
    const visitor = newVisitor();

    const { tournamentId } = await startTournament(db, visitor, { categoryId });
    const tournament = await getTournament(db, visitor, tournamentId);

    expect(tournament?.size).toBe(6);
    expect(tournament?.bracket.rounds[0].filter((m) => m.bye)).toHaveLength(2);
    expect(tournament?.bracket.matchesLeft).toBe(6);
  });

  it("accepts any size from 4 to the scope's contestant count", async () => {
    const { categoryId } = await createCategory(db, 10);
    const visitor = newVisitor();

    for (const size of [4, 7, 10]) {
      const { tournamentId } = await startTournament(db, visitor, { categoryId, size });
      expect((await getTournament(db, visitor, tournamentId))?.size).toBe(size);
    }
    await expect(startTournament(db, visitor, { categoryId, size: 3 })).rejects.toThrow(GameError);
    await expect(startTournament(db, visitor, { categoryId, size: 11 })).rejects.toThrow(GameError);
  });

  it("needs a scope of at least 4 contestants", async () => {
    const { categoryId } = await createCategory(db, 3);

    const scopes = await listTournamentScopes(db);
    expect(scopes.find((s) => s.categoryId === categoryId)).toMatchObject({ contestantCount: 3, sizes: null });
    await expect(startTournament(db, newVisitor(), { categoryId })).rejects.toThrow(GameError);
  });

  it("can draw from all contestants, across categories", async () => {
    const small = await createCategory(db, 3);
    const other = await createCategory(db, 3);
    const visitor = newVisitor();

    const all = (await listTournamentScopes(db)).find((s) => s.categoryId === null)!;
    expect(all.contestantCount).toBeGreaterThanOrEqual(6);

    const { tournamentId } = await startTournament(db, visitor, { categoryId: null, size: all.contestantCount });
    const tournament = await getTournament(db, visitor, tournamentId);
    expect(tournament?.scopeName).toBe("All contestants");
    const drawn = Object.keys(tournament!.contestants);
    for (const id of [...small.contestantIds, ...other.contestantIds]) expect(drawn).toContain(id);
  });
});

/** Picks the first contestant of the next match. */
async function pickNext(visitor: Visitor, tournamentId: string) {
  const tournament = await getTournament(db, visitor, tournamentId);
  const winnerId = tournament!.bracket.next!.contestantIds[0];
  await pickWinner(db, visitor, tournamentId, winnerId);
  return tournament!.bracket.next!;
}

describe("picking winners", () => {
  it("stores each pick immediately as an unrated match for the anonymous visitor", async () => {
    const { categoryId } = await createCategory(db, 8);
    const visitor = newVisitor();
    const { tournamentId } = await startTournament(db, visitor, { categoryId });

    const before = new Date();
    const played = await pickNext(visitor, tournamentId);

    const { data: matches } = await db.from("matches").select("*").eq("tournament_id", tournamentId);
    expect(matches).toHaveLength(1);
    expect(matches![0]).toMatchObject({
      winner_id: played.contestantIds[0],
      loser_id: played.contestantIds[1],
      category_id: categoryId,
      visitor_id: visitor.visitorId,
      player_id: null,
      rated: false,
      round: 1,
      excluded: false,
    });
    expect(new Date(matches![0].played_at).getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect((await getTournament(db, visitor, tournamentId))?.bracket.matchesLeft).toBe(7);
  });

  it("plays a full tournament of N matches to its tournament ranking", async () => {
    const { categoryId } = await createCategory(db, 5);
    const visitor = newVisitor();
    const { tournamentId } = await startTournament(db, visitor, { categoryId });

    for (let i = 0; i < 5; i++) await pickNext(visitor, tournamentId);

    const tournament = await getTournament(db, visitor, tournamentId);
    expect(tournament?.status).toBe("finished");
    expect(tournament?.bracket.ranking?.map((t) => t.place)).toEqual(["1st", "2nd", "3rd", "4th", "5th"]);
    const { count } = await db.from("matches").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId);
    expect(count).toBe(5);
    await expect(pickWinner(db, visitor, tournamentId, tournament!.bracket.ranking![0].contestantIds[0])).rejects.toThrow(GameError);
  });

  it("refuses a winner who isn't in the next match", async () => {
    const { categoryId } = await createCategory(db, 8);
    const visitor = newVisitor();
    const { tournamentId } = await startTournament(db, visitor, { categoryId });
    const next = (await getTournament(db, visitor, tournamentId))!.bracket.next!;
    const outsider = (await getTournament(db, visitor, tournamentId))!.bracket.rounds[0]
      .flatMap((m) => m.contestantIds)
      .find((id) => id && !next.contestantIds.includes(id))!;

    await expect(pickWinner(db, visitor, tournamentId, outsider)).rejects.toThrow(GameError);
  });

  it("refuses a repeated pick for a match that was already decided", async () => {
    const { categoryId } = await createCategory(db, 4);
    const visitor = newVisitor();
    const { tournamentId } = await startTournament(db, visitor, { categoryId });
    const first = await pickNext(visitor, tournamentId);
    await pickNext(visitor, tournamentId);
    const thirdPlace = (await getTournament(db, visitor, tournamentId))!.bracket.next!;

    await expect(
      pickWinner(db, visitor, tournamentId, thirdPlace.contestantIds[0], { matchIndex: first.index }),
    ).rejects.toThrow(GameError);
    expect((await getTournament(db, visitor, tournamentId))?.bracket.matchesPlayed).toBe(2);
  });

  it("keeps a tournament to the visitor who started it", async () => {
    const { categoryId } = await createCategory(db, 4);
    const owner = newVisitor();
    const stranger = newVisitor();
    const { tournamentId } = await startTournament(db, owner, { categoryId });
    const next = (await getTournament(db, owner, tournamentId))!.bracket.next!;

    expect(await getTournament(db, stranger, tournamentId)).toBeNull();
    await expect(pickWinner(db, stranger, tournamentId, next.contestantIds[0])).rejects.toThrow(GameError);
  });
});

describe("undoing a pick", () => {
  async function matchCount(tournamentId: string) {
    const { count } = await db.from("matches").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId);
    return count;
  }

  it("removes the most recent pick and its match, bringing that match back", async () => {
    const { categoryId } = await createCategory(db, 8);
    const visitor = newVisitor();
    const { tournamentId } = await startTournament(db, visitor, { categoryId });
    await pickNext(visitor, tournamentId);
    const second = await pickNext(visitor, tournamentId);

    await undoLastPick(db, visitor, tournamentId);

    const tournament = await getTournament(db, visitor, tournamentId);
    expect(tournament?.bracket.next).toEqual(second);
    expect(tournament?.bracket.matchesLeft).toBe(7);
    expect(await matchCount(tournamentId)).toBe(1);
  });

  it("allows only one undo until the next pick", async () => {
    const { categoryId } = await createCategory(db, 8);
    const visitor = newVisitor();
    const { tournamentId } = await startTournament(db, visitor, { categoryId });
    await pickNext(visitor, tournamentId);
    await pickNext(visitor, tournamentId);
    await undoLastPick(db, visitor, tournamentId);

    expect((await getTournament(db, visitor, tournamentId))?.canUndo).toBe(false);
    await expect(undoLastPick(db, visitor, tournamentId)).rejects.toThrow(GameError);
    expect(await matchCount(tournamentId)).toBe(1);

    await pickNext(visitor, tournamentId);
    expect((await getTournament(db, visitor, tournamentId))?.canUndo).toBe(true);
  });

  it("has nothing to undo before the first pick", async () => {
    const { categoryId } = await createCategory(db, 4);
    const visitor = newVisitor();
    const { tournamentId } = await startTournament(db, visitor, { categoryId });

    expect((await getTournament(db, visitor, tournamentId))?.canUndo).toBe(false);
    await expect(undoLastPick(db, visitor, tournamentId)).rejects.toThrow(GameError);
  });

  it("can take back the final pick, reopening the tournament", async () => {
    const { categoryId } = await createCategory(db, 4);
    const visitor = newVisitor();
    const { tournamentId } = await startTournament(db, visitor, { categoryId });
    for (let i = 0; i < 4; i++) await pickNext(visitor, tournamentId);

    await undoLastPick(db, visitor, tournamentId);

    const tournament = await getTournament(db, visitor, tournamentId);
    expect(tournament?.status).toBe("in_progress");
    expect(tournament?.bracket.ranking).toBeNull();
    expect(tournament?.bracket.matchesLeft).toBe(1);
  });

  it("is only for the visitor who started the tournament", async () => {
    const { categoryId } = await createCategory(db, 4);
    const owner = newVisitor();
    const { tournamentId } = await startTournament(db, owner, { categoryId });
    await pickNext(owner, tournamentId);

    await expect(undoLastPick(db, newVisitor(), tournamentId)).rejects.toThrow(GameError);
    expect(await matchCount(tournamentId)).toBe(1);
  });
});

describe("resuming", () => {
  it("lists the visitor's unfinished tournaments, newest first, with matches left", async () => {
    const { categoryId } = await createCategory(db, 4);
    const visitor = newVisitor();
    const finished = await startTournament(db, visitor, { categoryId });
    for (let i = 0; i < 4; i++) await pickNext(visitor, finished.tournamentId);
    const older = await startTournament(db, visitor, { categoryId });
    await pickNext(visitor, older.tournamentId);
    const newer = await startTournament(db, visitor, { categoryId });
    await startTournament(db, newVisitor(), { categoryId });

    const unfinished = await listUnfinishedTournaments(db, visitor);

    expect(unfinished.map((t) => [t.id, t.matchesLeft])).toEqual([
      [newer.tournamentId, 4],
      [older.tournamentId, 3],
    ]);
  });
});
