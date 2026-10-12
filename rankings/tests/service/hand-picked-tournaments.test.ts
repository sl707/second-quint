import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GameError,
  getAllowanceStatus,
  getTournament,
  listScopeContestants,
  listUnfinishedTournaments,
  pickWinner,
  startTournament,
  type Person,
} from "@/server/game";
import { createCategory, newPlayer, newVisitor, removeTestData } from "./fixtures";

const db = createAdminClient();

afterAll(() => removeTestData(db));

async function allowanceIn(player: { playerId: string }, categoryId: string | null) {
  const status = await getAllowanceStatus(db, player);
  return status.scopes.find((s) => s.categoryId === categoryId)!;
}

/** Picks the first contestant of every match until the tournament is finished. */
async function finish(person: Person, tournamentId: string) {
  for (;;) {
    const next = (await getTournament(db, person, tournamentId))!.bracket.next;
    if (!next) return;
    await pickWinner(db, person, tournamentId, next.contestantIds[0]);
  }
}

async function tournamentMatches(tournamentId: string) {
  const { data } = await db.from("matches").select("rated").eq("tournament_id", tournamentId);
  return data!;
}

describe("a hand-picked tournament", () => {
  it("holds exactly the contestants the player picked from the scope", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 10);
    const picked = [contestantIds[1], contestantIds[4], contestantIds[7], contestantIds[8], contestantIds[9]];
    const visitor = newVisitor();

    const started = await startTournament(db, visitor, { categoryId, contestantIds: picked });
    const tournament = await getTournament(db, visitor, started.tournamentId);

    expect(started).toMatchObject({ rated: false, unratedReason: "hand-picked" });
    expect(tournament?.size).toBe(5);
    const placed = tournament!.bracket.rounds[0].flatMap((m) => m.contestantIds).filter((id) => id !== null);
    expect(placed.toSorted()).toEqual(picked.toSorted());
  });

  it("is unrated because it was hand-picked, even for a signed-in player with allowance left", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 20);
    const player = await newPlayer(db);

    const started = await startTournament(db, player, { categoryId, contestantIds: contestantIds.slice(0, 8) });
    await finish(player, started.tournamentId);

    expect(started).toMatchObject({ rated: false, unratedReason: "hand-picked" });
    const matches = await tournamentMatches(started.tournamentId);
    expect(matches).toHaveLength(8);
    expect(matches.every((m) => !m.rated)).toBe(true);
    expect(await allowanceIn(player, categoryId)).toMatchObject({ used: 0, remaining: 20 });
  });

  it("starts nothing when the player expected it to be rated", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 20);
    const player = await newPlayer(db);

    await expect(
      startTournament(db, player, { categoryId, contestantIds: contestantIds.slice(0, 4), play: "rated" }),
    ).rejects.toThrow("Hand-picked tournaments are always unrated.");
    expect(await listUnfinishedTournaments(db, player)).toEqual([]);
  });

  it("needs at least 4 different contestants, all from the scope", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 6);
    const other = await createCategory(db, 4);
    const visitor = newVisitor();
    const [a, b, c] = contestantIds;

    await expect(startTournament(db, visitor, { categoryId, contestantIds: [a, b, c] })).rejects.toThrow(GameError);
    await expect(startTournament(db, visitor, { categoryId, contestantIds: [a, b, c, c] })).rejects.toThrow(GameError);
    await expect(
      startTournament(db, visitor, { categoryId, contestantIds: [a, b, c, other.contestantIds[0]] }),
    ).rejects.toThrow(GameError);
  });
});

describe("the contestants to pick from", () => {
  it("are the scope's contestants, by name", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 3);
    await db.from("contestants").update({ name: "Test zzzzzzzz" }).eq("id", contestantIds[0]);

    const contestants = await listScopeContestants(db, categoryId);

    expect(contestants.map((c) => c.id)).toEqual([contestantIds[1], contestantIds[2], contestantIds[0]]);
    expect(contestants[2]).toMatchObject({ name: "Test zzzzzzzz", picture128Url: "/samples/apple-128.svg" });
  });
});
