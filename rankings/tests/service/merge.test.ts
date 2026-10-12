import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminError, listOpenReports, mergeContestants } from "@/server/admin";
import {
  addContestantToCategory,
  findMergeSurvivor,
  getCategory,
  getContestant,
  reportItem,
  setCategoryCover,
} from "@/server/catalog";
import { getInfinitePair, getTournament, pickInfiniteWinner, pickWinner, startTournament } from "@/server/game";
import { getContestantStanding, getGlobalRanking, refreshGlobalRankings } from "@/server/rankings";
import { createCategory, makeAdmin, newPlayer, newVisitor, recordMatch, removeTestData } from "./fixtures";

const db = createAdminClient();

afterAll(() => removeTestData(db));

async function newAdmin() {
  const admin = await newPlayer(db);
  await makeAdmin(db, admin.playerId);
  return admin;
}

describe("merging duplicate contestants", () => {
  it("moves the duplicate's matches and categories to the survivor and drops matches between the two", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 3);
    const [duplicate, survivor, other] = contestantIds;
    const { categoryId: onlyDuplicateCategory, contestantIds: alone } = await createCategory(db, 1);
    const admin = await newAdmin();
    await addContestantToCategory(db, admin, onlyDuplicateCategory, duplicate);
    const player = await newPlayer(db);
    const play = (winnerId: string, loserId: string) =>
      recordMatch(db, { winnerId, loserId, categoryId, rated: true, playerId: player.playerId });
    await play(duplicate, other);
    await play(duplicate, other);
    await play(other, duplicate);
    await play(survivor, other);
    await play(duplicate, survivor);
    await play(survivor, duplicate);

    await mergeContestants(db, admin, duplicate, survivor);

    expect(await getContestant(db, duplicate)).toBeNull();
    expect((await getContestant(db, survivor))!.categories.map((c) => c.id).toSorted()).toEqual(
      [categoryId, onlyDuplicateCategory].toSorted(),
    );
    expect((await getCategory(db, onlyDuplicateCategory))!.contestants.map((c) => c.id).toSorted()).toEqual([survivor, ...alone].toSorted());
    expect((await getCategory(db, categoryId))!.contestants.map((c) => c.id).toSorted()).toEqual([survivor, other].toSorted());
    const standing = (await getContestantStanding(db, survivor, { rated: true }))!;
    expect(standing.record).toEqual({ wins: 3, losses: 1, matches: 4 });
    expect(standing.headToHead.map((h) => h.opponent.id)).toEqual([other]);

    await refreshGlobalRankings(db);
    const overall = (await getGlobalRanking(db, null, { rated: true }))!;
    expect(overall.ranked.map((r) => r.contestant.id)).not.toContain(duplicate);
    expect(overall.ranked.find((r) => r.contestant.id === survivor)?.matches).toBe(4);
    const category = (await getGlobalRanking(db, onlyDuplicateCategory, { rated: true }))!;
    expect(category.notYetJudged.map((c) => c.id).toSorted()).toEqual([survivor, ...alone].toSorted());
  });

  it("sends the duplicate's page to the survivor's, also for contestants merged into the duplicate earlier", async () => {
    const { contestantIds } = await createCategory(db, 3);
    const [earlier, duplicate, survivor] = contestantIds;
    const admin = await newAdmin();
    await mergeContestants(db, admin, earlier, duplicate);
    expect(await findMergeSurvivor(db, earlier)).toBe(duplicate);

    await mergeContestants(db, admin, duplicate, survivor);

    expect(await findMergeSurvivor(db, duplicate)).toBe(survivor);
    expect(await findMergeSurvivor(db, earlier)).toBe(survivor);
    expect(await findMergeSurvivor(db, survivor)).toBeNull();
    expect(await findMergeSurvivor(db, randomUUID())).toBeNull();
    expect(await findMergeSurvivor(db, "not-an-id")).toBeNull();
  });

  it("puts the survivor in the duplicate's place in tournaments, and ends tournaments that drew both", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 5);
    const [duplicate, survivor, a, b, c] = contestantIds;
    const visitor = newVisitor();
    const withDuplicate = (await startTournament(db, visitor, { categoryId, contestantIds: [duplicate, a, b, c] })).tournamentId;
    const first = (await getTournament(db, visitor, withDuplicate))!.bracket.next!;
    await pickWinner(db, visitor, withDuplicate, first.contestantIds.includes(duplicate) ? duplicate : first.contestantIds[0]);
    const withBoth = (await startTournament(db, visitor, { categoryId, contestantIds: [duplicate, survivor, a, b] })).tournamentId;

    await mergeContestants(db, await newAdmin(), duplicate, survivor);

    const continued = (await getTournament(db, visitor, withDuplicate))!;
    expect(continued.status).toBe("in_progress");
    expect(Object.keys(continued.contestants).toSorted()).toEqual([survivor, a, b, c].toSorted());
    expect(continued.bracket.matchesPlayed).toBe(1);
    for (let next = continued.bracket.next; next; next = (await getTournament(db, visitor, withDuplicate))!.bracket.next) {
      await pickWinner(db, visitor, withDuplicate, next.contestantIds.includes(survivor) ? survivor : next.contestantIds[0]);
    }
    const finished = (await getTournament(db, visitor, withDuplicate))!;
    expect(finished.bracket.ranking![0].contestantIds).toEqual([survivor]);
    expect((await getTournament(db, visitor, withBoth))!.status).toBe("removed");
  });

  it("hands over the duplicate's covers, offered pairs, stored ranking places, and open reports", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 3);
    const [duplicate, survivor, other] = contestantIds;
    const admin = await newAdmin();
    await setCategoryCover(db, admin, categoryId, duplicate);
    await recordMatch(db, { winnerId: duplicate, loserId: other, categoryId, rated: true });
    await refreshGlobalRankings(db);
    const visitor = newVisitor();
    await getInfinitePair(db, visitor, categoryId);
    await reportItem(db, visitor, { type: "contestant", id: duplicate }, "Same as the other one");

    await mergeContestants(db, admin, duplicate, survivor);

    expect((await getCategory(db, categoryId))!.chosenCoverId).toBe(survivor);
    const stored = (await getGlobalRanking(db, categoryId, { rated: true }))!;
    expect(stored.ranked.map((r) => [r.position, r.contestant.id])).toEqual([[1, other]]);
    expect(stored.notYetJudged.map((c) => c.id)).toEqual([survivor]);
    const pair = await getInfinitePair(db, visitor, categoryId);
    expect(pair.contestants.map((c) => c.id).toSorted()).toEqual([survivor, other].toSorted());
    await pickInfiniteWinner(db, visitor, { pairId: pair.pairId, winnerId: survivor });
    expect((await listOpenReports(db, admin)).map((r) => r.target?.id)).not.toContain(duplicate);

    await refreshGlobalRankings(db);
    const refreshed = (await getGlobalRanking(db, categoryId, { rated: false }))!;
    expect(refreshed.ranked.find((r) => r.contestant.id === survivor)).toMatchObject({ wins: 2, losses: 0 });
  });

  it("is admin only and refuses the same contestant twice, a missing one, or one already merged", async () => {
    const { contestantIds } = await createCategory(db, 3);
    const [duplicate, survivor, third] = contestantIds;
    const player = await newPlayer(db);
    const admin = await newAdmin();

    await expect(mergeContestants(db, player, duplicate, survivor)).rejects.toThrow(AdminError);
    await expect(mergeContestants(db, null, duplicate, survivor)).rejects.toThrow(AdminError);
    expect(await findMergeSurvivor(db, duplicate)).toBeNull();
    await expect(mergeContestants(db, admin, duplicate, duplicate)).rejects.toThrow("Pick two different contestants.");
    await expect(mergeContestants(db, admin, duplicate, randomUUID())).rejects.toThrow("doesn't exist");
    await expect(mergeContestants(db, admin, "nope", survivor)).rejects.toThrow("doesn't exist");

    await mergeContestants(db, admin, duplicate, survivor);
    await expect(mergeContestants(db, admin, duplicate, third)).rejects.toThrow("already merged");
    await expect(mergeContestants(db, admin, third, duplicate)).rejects.toThrow("already merged");
  });
});
