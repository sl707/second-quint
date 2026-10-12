import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getInfinitePair,
  getTournament,
  pickInfiniteWinner,
  pickWinner,
  startTournament,
  type SignedOutPickContext,
  type Person,
} from "@/server/game";
import { isVisitorVerified, verifyVisitor } from "@/server/human-check";
import { createCategory, newPlayer, newVisitor, removeTestData, TURNSTILE_TEST_TOKEN } from "./fixtures";

const db = createAdminClient();

/** Cloudflare's Turnstile test secret that rejects every token. */
const ALWAYS_FAIL_SECRET = "2x0000000000000000000000000000000AA";

afterEach(() => vi.unstubAllEnvs());
afterAll(() => removeTestData(db));

describe("the human check for signed-out play", () => {
  it("refuses a signed-out tournament pick until the visitor passes the check", async () => {
    const { categoryId } = await createCategory(db, 4);
    const visitor = newVisitor();
    const { tournamentId } = await startTournament(db, visitor, { categoryId });
    const winnerId = (await getTournament(db, visitor, tournamentId))!.bracket.next!.contestantIds[0];

    expect(await isVisitorVerified(db, visitor)).toBe(false);
    await expect(pickWinner(db, visitor, tournamentId, winnerId)).rejects.toThrow(/human/);
    expect((await getTournament(db, visitor, tournamentId))!.bracket.matchesPlayed).toBe(0);

    await verifyVisitor(db, visitor, TURNSTILE_TEST_TOKEN);
    expect(await isVisitorVerified(db, visitor)).toBe(true);
    await pickWinner(db, visitor, tournamentId, winnerId);
    expect((await getTournament(db, visitor, tournamentId))!.bracket.matchesPlayed).toBe(1);
  });

  it("refuses a signed-out Infinite Mode pick until the visitor passes the check, keeping the pair offered", async () => {
    const { categoryId } = await createCategory(db, 2);
    const visitor = newVisitor();
    const pair = await getInfinitePair(db, visitor, categoryId);
    const pick = { pairId: pair.pairId, winnerId: pair.contestants[0].id };

    await expect(pickInfiniteWinner(db, visitor, pick)).rejects.toThrow(/human/);
    expect((await getInfinitePair(db, visitor, categoryId)).pairId).toBe(pair.pairId);

    await verifyVisitor(db, visitor, TURNSTILE_TEST_TOKEN);
    await pickInfiniteWinner(db, visitor, pick);
    expect((await getInfinitePair(db, visitor, categoryId)).pairId).not.toBe(pair.pairId);
  });

  it("keeps refusing picks when Turnstile rejects the token", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", ALWAYS_FAIL_SECRET);
    const { categoryId } = await createCategory(db, 2);
    const visitor = newVisitor();
    const pair = await getInfinitePair(db, visitor, categoryId);

    await expect(verifyVisitor(db, visitor, TURNSTILE_TEST_TOKEN)).rejects.toThrow("We couldn't confirm you're human");
    await expect(pickInfiniteWinner(db, visitor, { pairId: pair.pairId, winnerId: pair.contestants[0].id })).rejects.toThrow(
      /human/,
    );
  });

  it("fails closed when the Turnstile secret isn't configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const { categoryId } = await createCategory(db, 2);
    const visitor = newVisitor();
    const pair = await getInfinitePair(db, visitor, categoryId);

    await expect(verifyVisitor(db, visitor, TURNSTILE_TEST_TOKEN)).rejects.toThrow("the human check isn't set up");
    await expect(pickInfiniteWinner(db, visitor, { pairId: pair.pairId, winnerId: pair.contestants[0].id })).rejects.toThrow(
      /human/,
    );
  });

  it("asks again once a passed check expires", async () => {
    const { categoryId } = await createCategory(db, 2);
    const visitor = newVisitor();
    await verifyVisitor(db, visitor, TURNSTILE_TEST_TOKEN);
    const pair = await getInfinitePair(db, visitor, categoryId);
    const later = new Date(Date.now() + 25 * 60 * 60 * 1000);

    expect(await isVisitorVerified(db, visitor, { now: later })).toBe(false);
    await expect(
      pickInfiniteWinner(db, visitor, { pairId: pair.pairId, winnerId: pair.contestants[0].id }, { now: later }),
    ).rejects.toThrow(/human/);
  });
});

/** Picks the first contestant of the person's offered pair until `count` picks are made. */
async function pickInfinite(person: Person, categoryId: string, count: number, context: SignedOutPickContext = {}) {
  for (let i = 0; i < count; i++) {
    const pair = await getInfinitePair(db, person, categoryId);
    await pickInfiniteWinner(db, person, { pairId: pair.pairId, winnerId: pair.contestants[0].id }, context);
  }
}

async function matchCount(categoryId: string) {
  const { count, error } = await db.from("matches").select("id", { count: "exact", head: true }).eq("category_id", categoryId);
  if (error) throw error;
  return count;
}

describe("the signed-out rate limit", () => {
  it("allows 30 picks a minute per visitor, then asks them to slow down without storing the match", async () => {
    const { categoryId } = await createCategory(db, 4);
    const visitor = newVisitor();
    await verifyVisitor(db, visitor, TURNSTILE_TEST_TOKEN);
    const start = new Date();

    await pickInfinite(visitor, categoryId, 30, { now: start });
    const pair = await getInfinitePair(db, visitor, categoryId);
    const pick = { pairId: pair.pairId, winnerId: pair.contestants[0].id };

    await expect(pickInfiniteWinner(db, visitor, pick, { now: new Date(start.getTime() + 30_000) })).rejects.toThrow(/slow down/i);
    expect(await matchCount(categoryId)).toBe(30);

    await pickInfiniteWinner(db, visitor, pick, { now: new Date(start.getTime() + 61_000) });
    expect(await matchCount(categoryId)).toBe(31);
  });

  it("allows 30 picks a minute per IP, however many visitor IDs share it", async () => {
    const { categoryId } = await createCategory(db, 4);
    const ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
    const visitors = [newVisitor(), newVisitor(), newVisitor()];
    for (const visitor of visitors) await verifyVisitor(db, visitor, TURNSTILE_TEST_TOKEN);

    for (const visitor of visitors) await pickInfinite(visitor, categoryId, 10, { ip });
    const latecomer = newVisitor();
    await verifyVisitor(db, latecomer, TURNSTILE_TEST_TOKEN);
    const pair = await getInfinitePair(db, latecomer, categoryId);

    await expect(pickInfiniteWinner(db, latecomer, { pairId: pair.pairId, winnerId: pair.contestants[0].id }, { ip })).rejects.toThrow(
      /slow down/i,
    );
    await pickInfiniteWinner(db, latecomer, { pairId: pair.pairId, winnerId: pair.contestants[0].id }, { ip: "203.0.113.9" });
    expect(await matchCount(categoryId)).toBe(31);
  });

  it("leaves signed-in players alone: no human check and no rate limit", async () => {
    const { categoryId } = await createCategory(db, 4);
    const { playerId } = await newPlayer(db);
    const ip = "198.51.100.254";

    await pickInfinite({ playerId }, categoryId, 35, { ip });
    expect(await matchCount(categoryId)).toBe(35);
  });
});
