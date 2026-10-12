import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInfinitePair, getTournament, pickInfiniteWinner, pickWinner, startTournament } from "@/server/game";
import { getPersonalRanking, listPersonalRankingScopes } from "@/server/rankings";
import { createCategory, newPlayer, recordMatch, removeTestData } from "./fixtures";

const db = createAdminClient();
const DAY = 24 * 60 * 60 * 1000;

afterAll(() => removeTestData(db));

describe("personal rankings", () => {
  it("are built only from that player's matches", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 3);
    const [a, b, c] = contestantIds;
    const player = await newPlayer(db);
    const someoneElse = await newPlayer(db);
    await recordMatch(db, { winnerId: b, loserId: a, categoryId, playerId: player.playerId });
    for (let i = 0; i < 5; i++) await recordMatch(db, { winnerId: a, loserId: b, categoryId, playerId: someoneElse.playerId });
    await recordMatch(db, { winnerId: c, loserId: a, categoryId });

    const ranking = await getPersonalRanking(db, player.playerId, categoryId, { rated: false });

    expect(ranking?.ranked.map((r) => [r.contestant.id, r.wins, r.losses])).toEqual([
      [b, 1, 0],
      [a, 0, 1],
    ]);
    expect(ranking?.notYetJudged.map((card) => card.id)).toEqual([c]);
  });

  it("weigh every match equally, however old", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const [oldFavorite, newFavorite] = contestantIds;
    const player = await newPlayer(db);
    const now = Date.now();
    for (let i = 0; i < 8; i++) {
      await recordMatch(db, {
        winnerId: oldFavorite,
        loserId: newFavorite,
        categoryId,
        playerId: player.playerId,
        playedAt: new Date(now - (365 + i) * DAY),
      });
    }
    for (let i = 0; i < 4; i++) await recordMatch(db, { winnerId: newFavorite, loserId: oldFavorite, categoryId, playerId: player.playerId });

    const ranking = await getPersonalRanking(db, player.playerId, categoryId, { rated: false });

    expect(ranking?.ranked.map((r) => r.contestant.id)).toEqual([oldFavorite, newFavorite]);
    expect(ranking?.ranked[0]).toMatchObject({ wins: 8, losses: 4, matches: 12 });
  });

  it("include a rated tournament pick straight away, in category and overall, rated and unrated", async () => {
    const { categoryId } = await createCategory(db, 4);
    const player = await newPlayer(db);
    const { tournamentId, rated } = await startTournament(db, player, { categoryId, size: 4 });
    expect(rated).toBe(true);
    const [winnerId, loserId] = (await getTournament(db, player, tournamentId))!.bracket.next!.contestantIds;
    await pickWinner(db, player, tournamentId, winnerId);

    for (const scope of [categoryId, null]) {
      for (const version of [true, false]) {
        const ranking = await getPersonalRanking(db, player.playerId, scope, { rated: version });
        expect(ranking?.rated).toBe(version);
        expect(ranking?.ranked.map((r) => [r.contestant.id, r.wins, r.losses])).toEqual([
          [winnerId, 1, 0],
          [loserId, 0, 1],
        ]);
      }
    }
  });

  it("count an unrated pick only in the unrated version", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const player = await newPlayer(db);
    const pair = await getInfinitePair(db, player, categoryId, { unrated: true });
    const [winner, loser] = pair.contestants;
    expect(await pickInfiniteWinner(db, player, { pairId: pair.pairId, winnerId: winner.id })).toEqual({ rated: false });

    const unrated = await getPersonalRanking(db, player.playerId, categoryId, { rated: false });
    expect(unrated?.ranked.map((r) => r.contestant.id)).toEqual([winner.id, loser.id]);
    const rated = await getPersonalRanking(db, player.playerId, categoryId, { rated: true });
    expect(rated?.ranked).toEqual([]);
    expect(rated?.notYetJudged.map((card) => card.id).sort()).toEqual([...contestantIds].sort());
  });

  it("count a match drawn from all contestants only in the overall ranking", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const [a, b] = contestantIds;
    const player = await newPlayer(db);
    await recordMatch(db, { winnerId: a, loserId: b, categoryId: null, playerId: player.playerId, rated: true });

    expect((await getPersonalRanking(db, player.playerId, categoryId, { rated: true }))?.ranked).toEqual([]);
    const overall = await getPersonalRanking(db, player.playerId, null, { rated: true });
    expect(overall?.scopeName).toBe("Overall Ranking");
    expect(overall?.ranked.map((r) => r.contestant.id)).toEqual([a, b]);
    expect(overall?.notYetJudged.length).toBeGreaterThan(0);
  });

  it("exist for overall and each category the player has played", async () => {
    const played = await createCategory(db, 2);
    const notPlayed = await createCategory(db, 2);
    const alsoPlayed = await createCategory(db, 2);
    const player = await newPlayer(db);
    const fresh = await newPlayer(db);
    for (const { categoryId, contestantIds } of [played, alsoPlayed]) {
      await recordMatch(db, { winnerId: contestantIds[0], loserId: contestantIds[1], categoryId, playerId: player.playerId });
    }
    await recordMatch(db, { winnerId: notPlayed.contestantIds[0], loserId: notPlayed.contestantIds[1], categoryId: notPlayed.categoryId });

    const scopes = await listPersonalRankingScopes(db, player.playerId);

    expect(scopes[0]).toEqual({ categoryId: null, name: "Overall Ranking" });
    expect(scopes.slice(1).map((s) => s.categoryId).sort()).toEqual([played.categoryId, alsoPlayed.categoryId].sort());
    expect(await listPersonalRankingScopes(db, fresh.playerId)).toEqual([{ categoryId: null, name: "Overall Ranking" }]);
  });

  it("leave out excluded matches", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const [a, b] = contestantIds;
    const player = await newPlayer(db);
    await recordMatch(db, { winnerId: a, loserId: b, categoryId, playerId: player.playerId, excluded: true });

    expect((await getPersonalRanking(db, player.playerId, categoryId, { rated: false }))?.ranked).toEqual([]);
  });
});
