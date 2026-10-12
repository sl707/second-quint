import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { GameError, getAllowanceStatus, getTournament, pickWinner, startTournament, type Person } from "@/server/game";
import { createCategory, newPlayer, newVerifiedVisitor, removeTestData } from "./fixtures";

const db = createAdminClient();

afterAll(() => removeTestData(db));

async function allowanceIn(player: { playerId: string }, categoryId: string | null, now?: Date) {
  const status = await getAllowanceStatus(db, player, { now });
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

/** An instant given as New York wall-clock time in winter (EST, UTC−5). */
const newYorkWinter = (wallClock: string) => new Date(`${wallClock}-05:00`);

describe("the rated allowance", () => {
  it("equals the number of contestants in the scope", async () => {
    const { categoryId } = await createCategory(db, 30);
    expect(await allowanceIn(await newPlayer(db), categoryId)).toMatchObject({ allowance: 30, used: 0, remaining: 30 });
  });

  it("is at least 20, even for a small scope", async () => {
    const { categoryId } = await createCategory(db, 5);
    expect(await allowanceIn(await newPlayer(db), categoryId)).toMatchObject({ allowance: 20, remaining: 20 });
  });

  it("is at most 500 for the all-contestants scope", async () => {
    const tag = randomUUID().slice(0, 8);
    const { error } = await db.from("contestants").insert(
      Array.from({ length: 501 }, (_, i) => ({
        name: `Bulk ${tag} ${i}`,
        picture_512_url: "/samples/apple-512.svg",
        picture_128_url: "/samples/apple-128.svg",
      })),
    );
    if (error) throw error;
    try {
      expect(await allowanceIn(await newPlayer(db), null)).toMatchObject({ allowance: 500, remaining: 500 });
    } finally {
      const { error: cleanupError } = await db.from("contestants").delete().like("name", `Bulk ${tag} %`);
      if (cleanupError) throw cleanupError;
    }
  });

  it("is kept separately for each scope", async () => {
    const a = await createCategory(db, 20);
    const b = await createCategory(db, 20);
    const player = await newPlayer(db);

    await startTournament(db, player, { categoryId: a.categoryId, size: 8 });

    expect(await allowanceIn(player, a.categoryId)).toMatchObject({ used: 8, remaining: 12 });
    expect(await allowanceIn(player, b.categoryId)).toMatchObject({ used: 0, remaining: 20 });
    expect(await allowanceIn(player, null)).toMatchObject({ used: 0 });
  });

  it("resets at midnight in New York", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    const lateEvening = newYorkWinter("2026-01-14T23:59:00");

    const full = await startTournament(db, player, { categoryId, size: 20, now: lateEvening });
    await finish(player, full.tournamentId);

    const status = await getAllowanceStatus(db, player, { now: lateEvening });
    expect(status.day).toBe("2026-01-14");
    expect(status.resetsAt).toBe("2026-01-15T05:00:00.000Z");
    expect(status.scopes.find((s) => s.categoryId === categoryId)).toMatchObject({ remaining: 0 });
    expect(await startTournament(db, player, { categoryId, size: 4, now: newYorkWinter("2026-01-14T23:59:59") })).toMatchObject({
      rated: false,
      unratedReason: "not-enough-allowance",
    });

    const justAfterMidnight = newYorkWinter("2026-01-15T00:00:01");
    expect(await allowanceIn(player, categoryId, justAfterMidnight)).toMatchObject({ used: 0, remaining: 20 });
    expect(await startTournament(db, player, { categoryId, size: 4, now: justAfterMidnight })).toMatchObject({ rated: true });
    expect(await allowanceIn(player, categoryId, justAfterMidnight)).toMatchObject({ used: 4, remaining: 16 });
  });
});

describe("starting a rated tournament", () => {
  it("is rated for a signed-in player and reserves all N matches up front", async () => {
    const { categoryId } = await createCategory(db, 30);
    const player = await newPlayer(db);

    const started = await startTournament(db, player, { categoryId, size: 16 });

    expect(started).toMatchObject({ rated: true, unratedReason: null });
    expect(await allowanceIn(player, categoryId)).toMatchObject({ allowance: 30, used: 16, remaining: 14 });
    expect(await getAllowanceStatus(db, player)).toMatchObject({ hasUnfinishedRatedTournament: true });
  });

  it("stores each match as rated the moment it's picked", async () => {
    const { categoryId } = await createCategory(db, 8);
    const player = await newPlayer(db);
    const { tournamentId } = await startTournament(db, player, { categoryId, size: 5 });

    const first = (await getTournament(db, player, tournamentId))!.bracket.next!;
    await pickWinner(db, player, tournamentId, first.contestantIds[0]);
    expect(await tournamentMatches(tournamentId)).toEqual([{ rated: true }]);
    expect((await getTournament(db, player, tournamentId))?.rated).toBe(true);

    await finish(player, tournamentId);
    expect(await tournamentMatches(tournamentId)).toEqual(Array(5).fill({ rated: true }));
    expect(await allowanceIn(player, categoryId)).toMatchObject({ used: 5 });
  });

  it("can be rated in the all-contestants scope", async () => {
    await createCategory(db, 4);
    const player = await newPlayer(db);

    expect(await startTournament(db, player, { categoryId: null, size: 4 })).toMatchObject({ rated: true });
    expect(await allowanceIn(player, null)).toMatchObject({ used: 4 });
  });
});

describe("a tournament is unrated", () => {
  it("for a signed-out visitor, whatever they ask for", async () => {
    const { categoryId } = await createCategory(db, 8);
    const visitor = await newVerifiedVisitor(db);

    const started = await startTournament(db, visitor, { categoryId, size: 4 });
    expect(started).toMatchObject({ rated: false, unratedReason: "signed-out" });
    await expect(startTournament(db, visitor, { categoryId, size: 4, expectRated: true })).rejects.toThrow(GameError);

    await finish(visitor, started.tournamentId);
    expect(await tournamentMatches(started.tournamentId)).toEqual(Array(4).fill({ rated: false }));
  });

  it("when the player chooses unrated, using none of their allowance", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);

    const started = await startTournament(db, player, { categoryId, size: 4, unrated: true });

    expect(started).toMatchObject({ rated: false, unratedReason: "chose-unrated" });
    expect(await allowanceIn(player, categoryId)).toMatchObject({ used: 0, remaining: 20 });
    await finish(player, started.tournamentId);
    expect(await tournamentMatches(started.tournamentId)).toEqual(Array(4).fill({ rated: false }));
  });

  it("while another rated tournament is unfinished, in any scope", async () => {
    const a = await createCategory(db, 20);
    const b = await createCategory(db, 20);
    const player = await newPlayer(db);
    await startTournament(db, player, { categoryId: a.categoryId, size: 4 });

    const second = await startTournament(db, player, { categoryId: b.categoryId, size: 4 });

    expect(second).toMatchObject({ rated: false, unratedReason: "unfinished-rated-tournament" });
    expect(await allowanceIn(player, b.categoryId)).toMatchObject({ used: 0 });
  });

  it("but an unfinished unrated tournament doesn't stop a rated one", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    await startTournament(db, player, { categoryId, size: 4, unrated: true });

    expect(await startTournament(db, player, { categoryId, size: 4 })).toMatchObject({ rated: true });
  });

  it("when its N matches don't all fit in the remaining allowance", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    const first = await startTournament(db, player, { categoryId, size: 16 });
    await finish(player, first.tournamentId);

    expect(await startTournament(db, player, { categoryId, size: 5 })).toMatchObject({
      rated: false,
      unratedReason: "not-enough-allowance",
    });
    expect(await allowanceIn(player, categoryId)).toMatchObject({ used: 16, remaining: 4 });
    expect(await startTournament(db, player, { categoryId, size: 4 })).toMatchObject({ rated: true });
    expect(await allowanceIn(player, categoryId)).toMatchObject({ used: 20, remaining: 0 });
  });

  it("only one of two rated starts at the same moment gets to be rated", async () => {
    const a = await createCategory(db, 20);
    const b = await createCategory(db, 20);
    const player = await newPlayer(db);

    const results = await Promise.all([
      startTournament(db, player, { categoryId: a.categoryId, size: 4 }),
      startTournament(db, player, { categoryId: b.categoryId, size: 4 }),
    ]);

    expect(results.map((r) => r.rated).sort()).toEqual([false, true]);
    expect(results.find((r) => !r.rated)?.unratedReason).toBe("unfinished-rated-tournament");
  });
});

describe("starting only if rated, as the player was told", () => {
  it("starts nothing and says why when the tournament can no longer be rated", async () => {
    const { categoryId } = await createCategory(db, 20);
    const player = await newPlayer(db);
    await startTournament(db, player, { categoryId, size: 4 });

    await expect(startTournament(db, player, { categoryId, size: 4, expectRated: true })).rejects.toThrow(
      /unfinished rated tournament/,
    );
    const { count } = await db.from("tournaments").select("id", { count: "exact", head: true }).eq("player_id", player.playerId);
    expect(count).toBe(1);
  });
});
