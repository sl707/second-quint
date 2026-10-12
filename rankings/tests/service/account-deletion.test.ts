import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminError, banPlayer, listOpenReports, renamePlayer } from "@/server/admin";
import {
  addContestant,
  addContestantToCategory,
  createCategory as createCatalogCategory,
  getCategory,
  getContestant,
  reportItem,
} from "@/server/catalog";
import {
  getInfinitePair,
  getTournament,
  listPastTournaments,
  listUnfinishedTournaments,
  pickInfiniteWinner,
  pickWinner,
  skipInfinitePair,
  startTournament,
} from "@/server/game";
import { chooseDisplayName, deleteAccount, findPlayerByUser, getProfile, isBannedIdentity, ProfileError } from "@/server/profiles";
import { getGlobalRanking, getPersonalRanking, refreshGlobalRankings, type GlobalRanking } from "@/server/rankings";
import { createCategory, makeAdmin, newPlayer, newUser, recordMatch, removeTestData, testPicture, uniqueDisplayName } from "./fixtures";

const db = createAdminClient();

afterAll(() => removeTestData(db));

const standings = (ranking: GlobalRanking | null) =>
  ranking!.ranked.map((r) => ({ id: r.contestant.id, wins: r.wins, losses: r.losses, matches: r.matches, score: r.score }));

function expectSameStandings(after: GlobalRanking | null, before: GlobalRanking | null) {
  const a = standings(after);
  const b = standings(before);
  const record = (rows: typeof a) => rows.map((r) => [r.id, r.wins, r.losses, r.matches]);
  expect(record(a)).toEqual(record(b));
  // The second refresh is a second later, so fading moves scores a hair.
  a.forEach((row, i) => expect(row.score).toBeCloseTo(b[i].score, 3));
}

async function playRatedTournament(player: { playerId: string }, categoryId: string) {
  const { tournamentId, rated } = await startTournament(db, player, { categoryId, size: 4 });
  expect(rated).toBe(true);
  for (;;) {
    const next = (await getTournament(db, player, tournamentId))!.bracket.next;
    if (!next) return tournamentId;
    await pickWinner(db, player, tournamentId, next.contestantIds[0]);
  }
}

describe("deleting an account", () => {
  it("leaves global rankings unchanged, rated and unrated", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 4);
    const player = await newPlayer(db);
    const other = await newPlayer(db);
    await playRatedTournament(player, categoryId);
    for (const unrated of [false, true]) {
      const pair = await getInfinitePair(db, player, categoryId, { unrated });
      expect(await pickInfiniteWinner(db, player, { pairId: pair.pairId, winnerId: pair.contestants[1].id })).toEqual({ rated: !unrated });
    }
    await recordMatch(db, { winnerId: contestantIds[3], loserId: contestantIds[0], categoryId, rated: true, playerId: other.playerId });

    const now = new Date();
    await refreshGlobalRankings(db, { now });
    const before = await Promise.all([true, false].map((rated) => getGlobalRanking(db, categoryId, { rated })));
    expect(standings(before[0]).reduce((n, r) => n + r.matches, 0)).toBe(2 * 6);
    expect(standings(before[1]).reduce((n, r) => n + r.matches, 0)).toBe(2 * 7);

    await deleteAccount(db, player);

    await refreshGlobalRankings(db, { now: new Date(now.getTime() + 1000) });
    const after = await Promise.all([true, false].map((rated) => getGlobalRanking(db, categoryId, { rated })));
    expectSameStandings(after[0], before[0]);
    expectSameStandings(after[1], before[1]);
  });

  it("leaves nothing personal: no profile, display name, tournaments, personal rankings, or email", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 6);
    const player = await newPlayer(db);
    const userId = (await db.from("players").select("user_id").eq("id", player.playerId).single()).data!.user_id as string;
    const reporter = await newPlayer(db);
    const admin = await newPlayer(db);
    await makeAdmin(db, admin.playerId);
    await playRatedTournament(player, categoryId);
    await startTournament(db, player, { categoryId, size: 4, unrated: true });
    const pair = await getInfinitePair(db, player, null);
    await skipInfinitePair(db, player, { pairId: pair.pairId });
    await getInfinitePair(db, player, categoryId);
    await reportItem(db, player, { type: "contestant", id: contestantIds[0] }, "Test duplicate");
    await reportItem(db, reporter, { type: "profile", id: player.playerId }, "Test rude name");

    await deleteAccount(db, player);

    expect(await getProfile(db, player.playerId)).toBeNull();
    expect(await getProfile(db, player.displayName)).toBeNull();
    expect(await findPlayerByUser(db, userId)).toBeNull();
    expect((await db.auth.admin.getUserById(userId)).data.user).toBeNull();
    expect(await listPastTournaments(db, player.playerId)).toEqual([]);
    expect(await listUnfinishedTournaments(db, player)).toEqual([]);
    for (const scope of [null, categoryId]) {
      for (const rated of [true, false]) {
        expect((await getPersonalRanking(db, player.playerId, scope, { rated }))!.ranked).toEqual([]);
      }
    }
    for (const table of ["matches", "tournaments", "allowance_use", "skip_use", "infinite_pairs"]) {
      expect((await db.from(table).select("player_id").eq("player_id", player.playerId)).data).toEqual([]);
    }
    expect((await db.from("reports").select("id").eq("reporter_player_id", player.playerId)).data).toEqual([]);
    const openReports = await listOpenReports(db, admin);
    expect(openReports.find((r) => r.targetType === "profile" && r.target?.id === player.playerId)).toBeUndefined();
    expect(openReports.find((r) => r.reason === "Test duplicate" && r.target?.id === contestantIds[0])?.reporter).toBeNull();

    // The display name is free again.
    const newcomer = await newUser(db);
    expect((await chooseDisplayName(db, newcomer.userId, player.displayName)).displayName).toBe(player.displayName);
  });

  it("keeps their contestants and categories, added by a deleted player who has no profile", async () => {
    const player = await newPlayer(db);
    const contestant = await addContestant(db, player, { name: "Test Deleted Creator", ...(await testPicture("#7c3aed")) });
    const { categoryId } = await createCatalogCategory(db, player, { name: "Test category by a deleted player", description: "" });
    await addContestantToCategory(db, player, categoryId, contestant.id);

    await deleteAccount(db, player);

    const kept = await getContestant(db, contestant.id);
    expect(kept).toMatchObject({ id: contestant.id, name: "Test Deleted Creator", createdBy: "deleted" });
    const category = await getCategory(db, categoryId);
    expect(category).toMatchObject({ name: "Test category by a deleted player", createdBy: "deleted" });
    expect(category!.contestants.map((c) => c.id)).toEqual([contestant.id]);

    const tombstone = (await db.from("contestants").select("created_by").eq("id", contestant.id).single()).data!.created_by;
    expect(await getProfile(db, tombstone)).toBeNull();
    const admin = await newPlayer(db);
    await makeAdmin(db, admin.playerId);
    await expect(renamePlayer(db, admin, tombstone, uniqueDisplayName())).rejects.toThrow(AdminError);
    await expect(banPlayer(db, admin, tombstone, { removeMatches: true })).rejects.toThrow(AdminError);
  });

  it("keeps a banned player who deleted their account from signing up again", async () => {
    const admin = await newPlayer(db);
    await makeAdmin(db, admin.playerId);
    const user = await newUser(db);
    const player = await chooseDisplayName(db, user.userId, uniqueDisplayName());
    await banPlayer(db, admin, player.id, { removeMatches: true });

    await deleteAccount(db, { playerId: player.id });

    const returning = await newUser(db, { email: user.email.toUpperCase() });
    expect(await isBannedIdentity(db, returning.userId)).toBe(true);
    await expect(chooseDisplayName(db, returning.userId, uniqueDisplayName())).rejects.toThrow(
      new ProfileError("This account is banned."),
    );
    expect(await findPlayerByUser(db, returning.userId)).toBeNull();

    // Only one-way hashes are kept, never the email or auth user ID.
    const { data: kept } = await db.from("banned_identities").select("*");
    const stored = JSON.stringify(kept);
    expect(stored).not.toContain(user.email);
    expect(stored).not.toContain(user.userId);
  });

  it("lets a player who wasn't banned sign up again after deleting their account", async () => {
    const user = await newUser(db);
    const player = await chooseDisplayName(db, user.userId, uniqueDisplayName());
    await deleteAccount(db, { playerId: player.id });

    const returning = await newUser(db, { email: user.email });
    expect(await isBannedIdentity(db, returning.userId)).toBe(false);
    expect((await chooseDisplayName(db, returning.userId, player.displayName)).displayName).toBe(player.displayName);
  });

  it("won't let the only admin delete their account until there's another admin", async () => {
    const admin = await newPlayer(db);
    const { data: others } = await db.from("players").select("id").eq("is_admin", true);
    await db.from("players").update({ is_admin: false }).in("id", others!.map((p) => p.id));
    try {
      await makeAdmin(db, admin.playerId);
      const onlyAdmin = new ProfileError("You're the only admin. Make another player the admin before deleting your account.");
      await expect(deleteAccount(db, admin)).rejects.toThrow(onlyAdmin);
      expect(await getProfile(db, admin.playerId)).not.toBeNull();

      // A banned admin isn't an admin.
      const second = await newPlayer(db);
      await makeAdmin(db, second.playerId);
      await banPlayer(db, admin, second.playerId, { removeMatches: false });
      await expect(deleteAccount(db, admin)).rejects.toThrow(onlyAdmin);

      await makeAdmin(db, (await newPlayer(db)).playerId);
      await deleteAccount(db, admin);
      expect(await getProfile(db, admin.playerId)).toBeNull();
    } finally {
      await db.from("players").update({ is_admin: true }).in("id", others!.map((p) => p.id));
    }
  });

  it("refuses an account that doesn't exist", async () => {
    const player = await newPlayer(db);
    await deleteAccount(db, player);

    await expect(deleteAccount(db, player)).rejects.toThrow(ProfileError);
  });
});
