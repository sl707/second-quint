import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminError, banPlayer, renamePlayer, unbanPlayer } from "@/server/admin";
import { addContestantToCategory, CatalogError, reportItem } from "@/server/catalog";
import {
  GameError,
  getInfinitePair,
  getTournament,
  pickInfiniteWinner,
  pickWinner,
  skipInfinitePair,
  startTournament,
  undoLastPick,
} from "@/server/game";
import { getProfile } from "@/server/profiles";
import {
  getContestantStanding,
  getGlobalRanking,
  getPersonalRanking,
  refreshGlobalRankings,
  type GlobalRanking,
  type PersonalRanking,
} from "@/server/rankings";
import { createCategory, makeAdmin, newPlayer, recordMatch, removeTestData, uniqueDisplayName } from "./fixtures";

const db = createAdminClient();

const matchCount = (ranking: GlobalRanking | PersonalRanking, contestantId: string) =>
  ranking.ranked.find((r) => r.contestant.id === contestantId)?.matches ?? 0;

afterAll(() => removeTestData(db));

async function newAdmin() {
  const admin = await newPlayer(db);
  await makeAdmin(db, admin.playerId);
  return admin;
}

describe("the admin renaming a player", () => {
  it("moves their profile to the new display name", async () => {
    const player = await newPlayer(db);
    const admin = await newAdmin();
    const newName = uniqueDisplayName("renamed");

    await renamePlayer(db, admin, player.playerId, `  ${newName} `);

    expect(await getProfile(db, newName.toUpperCase())).toMatchObject({ id: player.playerId, displayName: newName });
    expect(await getProfile(db, player.displayName)).toBeNull();
  });

  it("keeps display names unique and 3 to 24 characters, and is admin only", async () => {
    const player = await newPlayer(db);
    const other = await newPlayer(db);
    const admin = await newAdmin();

    await expect(renamePlayer(db, admin, player.playerId, other.displayName.toUpperCase())).rejects.toThrow("taken");
    await expect(renamePlayer(db, admin, player.playerId, "ab")).rejects.toThrow(AdminError);
    await expect(renamePlayer(db, admin, player.playerId, "x".repeat(25))).rejects.toThrow(AdminError);
    await expect(renamePlayer(db, admin, player.playerId, "has space")).rejects.toThrow(AdminError);
    await expect(renamePlayer(db, other, player.playerId, uniqueDisplayName())).rejects.toThrow(AdminError);
    await expect(renamePlayer(db, admin, "not-an-id", uniqueDisplayName())).rejects.toThrow(AdminError);
    expect((await getProfile(db, player.playerId))?.displayName).toBe(player.displayName);

    await renamePlayer(db, admin, player.playerId, player.displayName.toUpperCase());
    expect((await getProfile(db, player.playerId))?.displayName).toBe(player.displayName.toUpperCase());
  });
});

describe("a banned player", () => {
  it("can't play tournaments or Infinite Mode, add to the catalog, or report", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 6);
    const player = await newPlayer(db);
    const admin = await newAdmin();
    const { tournamentId } = await startTournament(db, player, { categoryId, size: 4 });
    const first = (await getTournament(db, player, tournamentId))!.bracket.next!;
    await pickWinner(db, player, tournamentId, first.contestantIds[0]);
    const pair = await getInfinitePair(db, player, categoryId);

    await banPlayer(db, admin, player.playerId, { removeMatches: false });

    await expect(startTournament(db, player, { categoryId, size: 4 })).rejects.toThrow(GameError);
    const next = (await getTournament(db, player, tournamentId))!.bracket.next!;
    await expect(pickWinner(db, player, tournamentId, next.contestantIds[0])).rejects.toThrow(GameError);
    await expect(undoLastPick(db, player, tournamentId)).rejects.toThrow(GameError);
    await expect(getInfinitePair(db, player, categoryId)).rejects.toThrow(GameError);
    const winnerId = pair.contestants[0].id;
    await expect(pickInfiniteWinner(db, player, { pairId: pair.pairId, winnerId })).rejects.toThrow(GameError);
    await expect(skipInfinitePair(db, player, { pairId: pair.pairId })).rejects.toThrow(GameError);
    await expect(addContestantToCategory(db, player, categoryId, contestantIds[5])).rejects.toThrow(CatalogError);
    await expect(reportItem(db, player, { type: "category", id: categoryId }, "Spam")).rejects.toThrow(CatalogError);
    expect((await getTournament(db, player, tournamentId))!.bracket.matchesPlayed).toBe(1);
  });

  it("keeps their matches in the rankings unless the admin removes them", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const [a, b] = contestantIds;
    const player = await newPlayer(db);
    const admin = await newAdmin();
    await recordMatch(db, { winnerId: a, loserId: b, categoryId, rated: true, playerId: player.playerId });

    await banPlayer(db, admin, player.playerId, { removeMatches: false });
    await refreshGlobalRankings(db);

    expect(matchCount((await getGlobalRanking(db, categoryId, { rated: true }))!, a)).toBe(1);
    expect(matchCount((await getPersonalRanking(db, player.playerId, categoryId, { rated: true }))!, a)).toBe(1);
  });

  it("can only be banned by the admin, who can't ban themselves", async () => {
    const player = await newPlayer(db);
    const other = await newPlayer(db);
    const admin = await newAdmin();

    await expect(banPlayer(db, other, player.playerId, { removeMatches: false })).rejects.toThrow(AdminError);
    await expect(banPlayer(db, admin, admin.playerId, { removeMatches: false })).rejects.toThrow(AdminError);
    await expect(banPlayer(db, admin, "not-an-id", { removeMatches: false })).rejects.toThrow(AdminError);
    await expect(unbanPlayer(db, other, player.playerId)).rejects.toThrow(AdminError);
    await startTournament(db, player, { categoryId: (await createCategory(db, 4)).categoryId, size: 4 });
  });
});

describe("removing a banned player's matches", () => {
  it("takes them out of every ranking at the next refresh, and unbanning brings them back", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 3);
    const [a, b, c] = contestantIds;
    const banned = await newPlayer(db);
    const other = await newPlayer(db);
    const admin = await newAdmin();
    await recordMatch(db, { winnerId: a, loserId: b, categoryId, rated: true, playerId: banned.playerId });
    await recordMatch(db, { winnerId: a, loserId: c, categoryId, playerId: banned.playerId });
    await recordMatch(db, { winnerId: a, loserId: c, categoryId: null, rated: true, playerId: banned.playerId });
    await recordMatch(db, { winnerId: b, loserId: c, categoryId, rated: true, playerId: other.playerId });
    await refreshGlobalRankings(db);

    await banPlayer(db, admin, banned.playerId, { removeMatches: true });
    // Stored rankings only change at the next refresh.
    expect(matchCount((await getGlobalRanking(db, categoryId, { rated: true }))!, a)).toBe(1);
    await refreshGlobalRankings(db);

    for (const rated of [true, false]) {
      expect(matchCount((await getGlobalRanking(db, categoryId, { rated }))!, a)).toBe(0);
      expect(matchCount((await getGlobalRanking(db, null, { rated }))!, a)).toBe(0);
      expect(matchCount((await getGlobalRanking(db, categoryId, { rated }))!, b)).toBe(1);
      expect((await getPersonalRanking(db, banned.playerId, null, { rated }))!.ranked).toEqual([]);
      expect((await getContestantStanding(db, a, { rated }))!.record.matches).toBe(0);
    }

    await unbanPlayer(db, admin, banned.playerId);
    await getInfinitePair(db, banned, categoryId);
    await refreshGlobalRankings(db);

    expect(matchCount((await getGlobalRanking(db, categoryId, { rated: true }))!, a)).toBe(1);
    expect(matchCount((await getGlobalRanking(db, categoryId, { rated: false }))!, a)).toBe(2);
    expect(matchCount((await getGlobalRanking(db, null, { rated: false }))!, a)).toBe(3);
    expect(matchCount((await getPersonalRanking(db, banned.playerId, null, { rated: true }))!, a)).toBe(2);
    expect((await getContestantStanding(db, a, { rated: false }))!.record.matches).toBe(3);
  });
});
