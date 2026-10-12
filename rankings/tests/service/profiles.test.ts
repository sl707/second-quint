import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { banPlayer } from "@/server/admin";
import { getTournament, listPastTournaments, pickWinner, startTournament } from "@/server/game";
import { chooseDisplayName, deleteAccount, findPlayerByUser, getProfile, ProfileError, searchPlayers } from "@/server/profiles";
import { getPersonalRanking, listPersonalRankingScopes } from "@/server/rankings";
import { createCategory, makeAdmin, newPlayer, newUser, recordMatch, removeTestData, uniqueDisplayName } from "./fixtures";

const db = createAdminClient();
const anyone = createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
  auth: { persistSession: false },
});

afterAll(() => removeTestData(db));

describe("choosing a display name", () => {
  it("has no player for a user who just signed in", async () => {
    const { userId } = await newUser(db);
    expect(await findPlayerByUser(db, userId)).toBeNull();
  });

  it("creates the player with the chosen display name", async () => {
    const { userId } = await newUser(db);
    const name = uniqueDisplayName();

    const player = await chooseDisplayName(db, userId, `  ${name} `);

    expect(player.displayName).toBe(name);
    expect(await findPlayerByUser(db, userId)).toEqual(player);
  });

  it("refuses a display name already taken, ignoring case", async () => {
    const name = uniqueDisplayName("Taken");
    await chooseDisplayName(db, (await newUser(db)).userId, name);
    const { userId } = await newUser(db);

    await expect(chooseDisplayName(db, userId, name.toUpperCase())).rejects.toThrow(
      new ProfileError("That display name is taken."),
    );
    expect(await findPlayerByUser(db, userId)).toBeNull();
  });

  it("refuses display names shorter than 3 or longer than 24 characters", async () => {
    const { userId } = await newUser(db);

    await expect(chooseDisplayName(db, userId, "ab")).rejects.toThrow(ProfileError);
    await expect(chooseDisplayName(db, userId, "a".repeat(25))).rejects.toThrow(ProfileError);
    expect(await findPlayerByUser(db, userId)).toBeNull();
  });

  it("enforces the length and case-insensitive uniqueness rules in the database too", async () => {
    const name = uniqueDisplayName();
    await chooseDisplayName(db, (await newUser(db)).userId, name);
    const { userId } = await newUser(db);

    expect((await db.from("players").insert({ user_id: userId, display_name: "ab" })).error).not.toBeNull();
    expect((await db.from("players").insert({ user_id: userId, display_name: name.toUpperCase() })).error?.code).toBe(
      "23505",
    );
  });

  it("is chosen once; a player can't pick another", async () => {
    const { userId } = await newUser(db);
    await chooseDisplayName(db, userId, uniqueDisplayName());

    await expect(chooseDisplayName(db, userId, uniqueDisplayName())).rejects.toThrow(ProfileError);
  });
});

describe("profiles", () => {
  it("finds a profile by display name in any case, or by player ID", async () => {
    const player = await chooseDisplayName(db, (await newUser(db)).userId, uniqueDisplayName("Prof"));

    expect(await getProfile(db, player.displayName.toLowerCase())).toEqual(player);
    expect(await getProfile(db, player.id)).toEqual(player);
    expect(await getProfile(db, "nobody_here")).toBeNull();
  });

  it("never carries the player's real name or email", async () => {
    const user = await newUser(db);
    const player = await chooseDisplayName(db, user.userId, uniqueDisplayName());

    const json = JSON.stringify(await getProfile(db, player.id));
    expect(json).not.toContain(user.email);
    expect(json).not.toContain(user.fullName);
  });

  it("lets anyone read display names but not which auth user a player is", async () => {
    const player = await chooseDisplayName(db, (await newUser(db)).userId, uniqueDisplayName());

    const { data } = await anyone.from("players").select("id, display_name").eq("id", player.id);
    expect(data).toEqual([{ id: player.id, display_name: player.displayName }]);
    expect((await anyone.from("players").select("user_id").limit(1)).error).not.toBeNull();
    expect((await anyone.from("players").insert({ display_name: "sneaky" })).error).not.toBeNull();
  });

  it("show anyone the player's past tournaments, newest first: finished with their ranking, unfinished as in progress", async () => {
    const { categoryId } = await createCategory(db, 4);
    const player = await newPlayer(db);
    const someoneElse = await newPlayer(db);
    const finished = await startTournament(db, player, { categoryId, size: 4, play: "unrated" });
    for (let i = 0; i < 4; i++) {
      const next = (await getTournament(db, player, finished.tournamentId))!.bracket.next!;
      await pickWinner(db, player, finished.tournamentId, next.contestantIds[0]);
    }
    const unfinished = await startTournament(db, player, { categoryId, size: 4 });
    const next = (await getTournament(db, player, unfinished.tournamentId))!.bracket.next!;
    await pickWinner(db, player, unfinished.tournamentId, next.contestantIds[0]);
    await startTournament(db, someoneElse, { categoryId, size: 4 });

    const tournaments = await listPastTournaments(anyone, player.playerId);

    expect(tournaments.map((t) => [t.id, t.status, t.rated])).toEqual([
      [unfinished.tournamentId, "in_progress", true],
      [finished.tournamentId, "finished", false],
    ]);
    expect(tournaments[0].ranking).toBeNull();
    const played = (await getTournament(db, player, finished.tournamentId))!;
    expect(tournaments[1]).toMatchObject({ scopeName: played.scopeName, size: 4 });
    expect(tournaments[1].ranking?.map((tier) => [tier.place, tier.contestants.map((c) => c.id)])).toEqual(
      played.bracket.ranking!.map((tier) => [tier.place, tier.contestantIds]),
    );
    expect(tournaments[1].ranking?.[0].contestants[0]).toEqual(played.contestants[played.bracket.ranking![0].contestantIds[0]]);
  });

  it("lets anyone search players by the start of their display name, ignoring case", async () => {
    const tag = randomUUID().slice(0, 6);
    const choose = async (name: string) => chooseDisplayName(db, (await newUser(db)).userId, name);
    const alpha = await choose(`Srch${tag}_Alpha`);
    const beta = await choose(`srch${tag}-beta`);
    await choose(`x_srch${tag}`);
    await choose(`Srch${tag}xAlpha`);

    const found = await searchPlayers(anyone, `SRCH${tag}`);
    expect(found.map((p) => p.displayName).sort()).toEqual([alpha.displayName, beta.displayName, `Srch${tag}xAlpha`].sort());
    expect(found.find((p) => p.id === alpha.id)).toEqual(alpha);
    // An underscore is a letter of the name, not a wildcard.
    expect((await searchPlayers(anyone, `srch${tag}_`)).map((p) => p.id)).toEqual([alpha.id]);
    expect(await searchPlayers(anyone, "  ")).toEqual([]);
    expect(await searchPlayers(anyone, "%")).toEqual([]);
  });

  it("leaves banned players and deleted accounts out of the search", async () => {
    const tag = randomUUID().slice(0, 6);
    const admin = await newPlayer(db);
    await makeAdmin(db, admin.playerId);
    const banned = await chooseDisplayName(db, (await newUser(db)).userId, `Ban${tag}_one`);
    const kept = await chooseDisplayName(db, (await newUser(db)).userId, `Ban${tag}_two`);
    await banPlayer(db, admin, banned.id, { removeMatches: false });

    expect((await searchPlayers(anyone, `ban${tag}`)).map((p) => p.id)).toEqual([kept.id]);
    await deleteAccount(db, { playerId: kept.id });
    expect(await searchPlayers(anyone, `ban${tag}`)).toEqual([]);
  });

  it("show anyone the player's personal rankings", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const player = await newPlayer(db);
    await recordMatch(db, { winnerId: contestantIds[1], loserId: contestantIds[0], categoryId, playerId: player.playerId });

    expect((await listPersonalRankingScopes(anyone, player.playerId)).map((s) => s.categoryId)).toEqual([null, categoryId]);
    const ranking = await getPersonalRanking(anyone, player.playerId, categoryId, { rated: false });
    expect(ranking?.ranked.map((r) => r.contestant.id)).toEqual([contestantIds[1], contestantIds[0]]);
  });
});
