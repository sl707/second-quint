import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminError, closeReport, deleteCategory, listOpenReports, removeContestantFromCategory } from "@/server/admin";
import {
  addContestantToCategory,
  CatalogError,
  createCategory as createCatalogCategory,
  deleteContestant,
  getCategory,
  reportItem,
  setCategoryCover,
} from "@/server/catalog";
import { getTournament, listPastTournaments, pickWinner, startTournament } from "@/server/game";
import {
  getContestantRankings,
  getGlobalRanking,
  getPersonalRanking,
  listPersonalRankingScopes,
  listRankingScopes,
  refreshGlobalRankings,
  type GlobalRanking,
  type PersonalRanking,
} from "@/server/rankings";
import {
  createCategory,
  makeAdmin,
  newPlayer,
  newVisitor,
  recordMatch,
  removeTestData,
  signedInClient,
} from "./fixtures";

const db = createAdminClient();
const anyone = createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
  auth: { persistSession: false },
});

afterAll(() => removeTestData(db));

async function newAdmin() {
  const admin = await newPlayer(db);
  await makeAdmin(db, admin.playerId);
  return admin;
}

describe("reports", () => {
  it("let anyone report a contestant, category, or profile with a short reason, for the admin's queue", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 2);
    const visitor = newVisitor();
    const player = await newPlayer(db);
    const reported = await newPlayer(db);
    const admin = await newAdmin();

    await reportItem(db, visitor, { type: "contestant", id: contestantIds[0] }, "  Not a pizza topping ");
    await reportItem(db, player, { type: "category", id: categoryId }, "Offensive name");
    await reportItem(db, player, { type: "profile", id: reported.playerId }, "Rude display name");

    const queue = await listOpenReports(db, admin);
    const contestantReport = queue.find((r) => r.target?.id === contestantIds[0]);
    expect(contestantReport).toMatchObject({
      targetType: "contestant",
      reason: "Not a pizza topping",
      reporter: null,
      target: { href: `/contestants/${contestantIds[0]}` },
    });
    expect(queue.find((r) => r.target?.id === categoryId)).toMatchObject({
      targetType: "category",
      reason: "Offensive name",
      reporter: { id: player.playerId, displayName: player.displayName },
      target: { href: `/categories/${categoryId}`, name: expect.stringContaining("Test category") },
    });
    expect(queue.find((r) => r.target?.id === reported.playerId)).toMatchObject({
      targetType: "profile",
      target: { name: reported.displayName, href: `/players/${reported.displayName}` },
    });
  });

  it("refuse a blank or long reason, or something that doesn't exist, and add nothing when reported again", async () => {
    const { contestantIds } = await createCategory(db, 1);
    const player = await newPlayer(db);
    const target = { type: "contestant", id: contestantIds[0] } as const;

    await expect(reportItem(db, player, target, "   ")).rejects.toThrow(CatalogError);
    await expect(reportItem(db, player, target, "x".repeat(281))).rejects.toThrow(CatalogError);
    await expect(reportItem(db, player, { type: "category", id: contestantIds[0] }, "Spam")).rejects.toThrow(CatalogError);
    await expect(reportItem(db, player, { type: "profile", id: "not-an-id" }, "Spam")).rejects.toThrow(CatalogError);

    await reportItem(db, player, target, "x".repeat(280));
    await reportItem(db, player, target, "Again");

    const queue = await listOpenReports(db, await newAdmin());
    expect(queue.filter((r) => r.target?.id === contestantIds[0])).toHaveLength(1);
  });

  it("leave the queue once the admin resolves or dismisses them; nobody else can see or close them", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 1);
    const player = await newPlayer(db);
    const admin = await newAdmin();
    await reportItem(db, player, { type: "contestant", id: contestantIds[0] }, "Duplicate");
    await reportItem(db, player, { type: "category", id: categoryId }, "Empty");
    const mine = (await listOpenReports(db, admin)).filter((r) => r.reporter?.id === player.playerId);
    expect(mine).toHaveLength(2);

    await expect(listOpenReports(db, player)).rejects.toThrow(AdminError);
    await expect(closeReport(db, player, mine[0].id, "dismissed")).rejects.toThrow(AdminError);
    const banned = await newAdmin();
    await db.from("players").update({ banned: true }).eq("id", banned.playerId);
    await expect(listOpenReports(db, banned)).rejects.toThrow(AdminError);

    await closeReport(db, admin, mine[0].id, "resolved");
    await closeReport(db, admin, mine[1].id, "dismissed");

    expect((await listOpenReports(db, admin)).filter((r) => r.reporter?.id === player.playerId)).toEqual([]);
    await expect(closeReport(db, admin, mine[0].id, "dismissed")).rejects.toThrow(AdminError);
  });

  it("can only be read by the admin, and never written, from the browser", async () => {
    const { contestantIds } = await createCategory(db, 1);
    const player = await newPlayer(db);
    await reportItem(db, player, { type: "contestant", id: contestantIds[0] }, "Blurry picture");
    const admin = await newAdmin();
    const asPlayer = await signedInClient(db, player.email);
    const asAdmin = await signedInClient(db, admin.email);
    const forTarget = (client: typeof anyone) => client.from("reports").select("reason").eq("target_id", contestantIds[0]);

    expect((await forTarget(anyone)).data ?? []).toEqual([]);
    expect((await forTarget(asPlayer)).data).toEqual([]);
    expect((await forTarget(asAdmin)).data).toEqual([{ reason: "Blurry picture" }]);
    expect((await asAdmin.from("reports").select("reporter_visitor_id").limit(1)).error).not.toBeNull();

    const sneaky = { target_type: "contestant", target_id: contestantIds[0], reason: "Sneaky" };
    expect((await anyone.from("reports").insert(sneaky)).error).not.toBeNull();
    expect((await asAdmin.from("reports").insert(sneaky)).error).not.toBeNull();
    expect((await asAdmin.from("reports").update({ status: "dismissed" }).eq("target_id", contestantIds[0]).select()).data ?? []).toEqual([]);
  });
});

const matchCount = (ranking: GlobalRanking | PersonalRanking, contestantId: string) =>
  ranking.ranked.find((r) => r.contestant.id === contestantId)?.matches ?? 0;

describe("removing a contestant from a category", () => {
  it("takes it out of that category's rankings at once, while its matches still count toward overall", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 3);
    const [removed, a, b] = contestantIds;
    const player = await newPlayer(db);
    for (let i = 0; i < 3; i++) await recordMatch(db, { winnerId: removed, loserId: a, categoryId, rated: true, playerId: player.playerId });
    await recordMatch(db, { winnerId: a, loserId: b, categoryId, rated: true, playerId: player.playerId });
    await refreshGlobalRankings(db);
    const admin = await newAdmin();
    await setCategoryCover(db, admin, categoryId, removed);

    await removeContestantFromCategory(db, admin, categoryId, removed);

    const category = (await getCategory(db, categoryId))!;
    expect(category.contestants.map((c) => c.id)).not.toContain(removed);
    expect(category.chosenCoverId).toBeNull();
    const stored = (await getGlobalRanking(db, categoryId, { rated: true }))!;
    expect(stored.ranked.map((r) => r.contestant.id)).not.toContain(removed);
    expect(stored.ranked.map((r) => r.position)).toEqual([1, 2]);
    expect((await getContestantRankings(db, removed, { rated: true }))!.scopes.map((s) => s.categoryId)).toEqual([null]);

    await refreshGlobalRankings(db);
    const categoryRanking = (await getGlobalRanking(db, categoryId, { rated: true }))!;
    expect(categoryRanking.ranked.map((r) => r.contestant.id)).not.toContain(removed);
    expect(matchCount(categoryRanking, a)).toBe(1);
    expect(matchCount((await getGlobalRanking(db, null, { rated: true }))!, removed)).toBe(3);
    const personal = (await getPersonalRanking(db, player.playerId, categoryId, { rated: true }))!;
    expect(personal.ranked.map((r) => r.contestant.id)).not.toContain(removed);
    expect(matchCount((await getPersonalRanking(db, player.playerId, null, { rated: true }))!, removed)).toBe(3);
  });

  it("is admin only, even for the category's creator", async () => {
    const creator = await newPlayer(db);
    const { categoryId } = await createCatalogCategory(db, creator, { name: `Test category ${randomUUID().slice(0, 8)}`, description: "" });
    const { contestantIds } = await createCategory(db, 1);
    await addContestantToCategory(db, creator, categoryId, contestantIds[0]);

    await expect(removeContestantFromCategory(db, creator, categoryId, contestantIds[0])).rejects.toThrow(AdminError);
    await expect(removeContestantFromCategory(db, null, categoryId, contestantIds[0])).rejects.toThrow(AdminError);
    expect((await getCategory(db, categoryId))!.contestants).toHaveLength(1);
    await expect(removeContestantFromCategory(db, await newAdmin(), categoryId, randomUUID())).rejects.toThrow(AdminError);
  });
});

describe("deleting a category", () => {
  it("removes its rankings and ends its unfinished tournaments, while its matches still count toward overall", async () => {
    const { categoryId, contestantIds } = await createCategory(db, 4);
    const [a, b] = contestantIds;
    const player = await newPlayer(db);
    for (let i = 0; i < 2; i++) await recordMatch(db, { winnerId: a, loserId: b, categoryId, rated: true, playerId: player.playerId });
    const { tournamentId } = await startTournament(db, player, { categoryId, size: 4, unrated: true });
    await reportItem(db, player, { type: "category", id: categoryId }, "Duplicate of another");
    await refreshGlobalRankings(db);
    const admin = await newAdmin();

    await expect(deleteCategory(db, player, categoryId)).rejects.toThrow(AdminError);
    await deleteCategory(db, admin, categoryId);

    expect(await getCategory(db, categoryId)).toBeNull();
    expect(await getGlobalRanking(db, categoryId, { rated: true })).toBeNull();
    expect((await listRankingScopes(db)).map((s) => s.categoryId)).not.toContain(categoryId);
    expect((await getTournament(db, player, tournamentId))?.status).toBe("removed");
    expect((await listOpenReports(db, admin)).map((r) => r.target?.id)).not.toContain(categoryId);

    await refreshGlobalRankings(db);
    expect(matchCount((await getGlobalRanking(db, null, { rated: true }))!, a)).toBe(2);
    expect(matchCount((await getPersonalRanking(db, player.playerId, null, { rated: true }))!, a)).toBe(2);
    expect((await listPersonalRankingScopes(db, player.playerId)).map((s) => s.categoryId)).toEqual([null]);
    await expect(deleteCategory(db, admin, categoryId)).rejects.toThrow(AdminError);
  });
});

describe("the admin deleting a contestant", () => {
  it("ends other players' tournaments that drew it without a ranking, keeping their other matches", async () => {
    const { categoryId } = await createCategory(db, 4);
    const player = await newPlayer(db);
    const { tournamentId } = await startTournament(db, player, { categoryId, size: 4 });
    for (let next = (await getTournament(db, player, tournamentId))!.bracket.next; next; ) {
      await pickWinner(db, player, tournamentId, next.contestantIds[0]);
      next = (await getTournament(db, player, tournamentId))!.bracket.next;
    }
    const loser = (await getTournament(db, player, tournamentId))!.bracket.ranking!.at(-1)!.contestantIds[0];
    await reportItem(db, player, { type: "contestant", id: loser }, "Wrong picture");
    const admin = await newAdmin();

    await deleteContestant(db, admin, loser);

    const [past] = await listPastTournaments(db, player.playerId);
    expect(past).toMatchObject({ id: tournamentId, status: "removed", ranking: null });
    expect((await listOpenReports(db, admin)).map((r) => r.target?.id)).not.toContain(loser);
    await refreshGlobalRankings(db);
    const ranking = (await getGlobalRanking(db, categoryId, { rated: true }))!;
    // A 4-contestant bracket has 4 matches; the last-placed contestant played 2 of them.
    expect(ranking.ranked.reduce((sum, r) => sum + r.matches, 0) / 2).toBe(2);
  });
});
