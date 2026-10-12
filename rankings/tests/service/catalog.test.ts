import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addContestant,
  addContestantToCategory,
  CatalogError,
  createCategory,
  deleteContestant,
  editCategory,
  editContestant,
  findSimilarContestants,
  getCategory,
  getContestant,
  listCategories,
  setCategoryCover,
} from "@/server/catalog";
import { getTournament, startTournament } from "@/server/game";
import { refreshGlobalRankings } from "@/server/rankings";
import { makeAdmin, newPlayer, newVisitor, recordMatch, removeTestData, testPicture } from "./fixtures";

const db = createAdminClient();

afterAll(() => removeTestData(db));

describe("adding a contestant", () => {
  it("goes live with both picture sizes stored under content-addressed names that cache forever", async () => {
    const player = await newPlayer(db);
    const pictures = await testPicture("#e11d48");

    const contestant = await addContestant(db, player, { name: "  Test Raspberry  ", ...pictures });

    expect(contestant.name).toBe("Test Raspberry");
    expect(contestant.createdBy).toEqual({ id: player.playerId, displayName: player.displayName });
    for (const [url, bytes] of [
      [contestant.picture512Url, pictures.picture512],
      [contestant.picture128Url, pictures.picture128],
    ] as const) {
      const response = await fetch(url);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/webp");
      expect(response.headers.get("cache-control")).toContain("max-age=31536000");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    }

    const again = await addContestant(db, player, { name: "Test Raspberry twin", ...pictures });
    expect(again.picture512Url).toBe(contestant.picture512Url);
    expect(again.picture128Url).not.toBe(contestant.picture512Url);
  });

  it("refuses a blank name or a picture that wasn't resized", async () => {
    const player = await newPlayer(db);
    const pictures = await testPicture("#16a34a");
    const png = new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).png().toBuffer());

    await expect(addContestant(db, player, { name: "   ", ...pictures })).rejects.toThrow(CatalogError);
    await expect(addContestant(db, player, { name: "Test PNG", picture512: png, picture128: png })).rejects.toThrow(
      CatalogError,
    );
  });

  it("refuses banned players", async () => {
    const player = await newPlayer(db);
    await db.from("players").update({ banned: true }).eq("id", player.playerId);

    await expect(addContestant(db, player, { name: "Test Banned", ...(await testPicture("#000")) })).rejects.toThrow(
      CatalogError,
    );
  });
});

describe("similar-name warning", () => {
  it("finds existing contestants with similar names, ignoring case and accents", async () => {
    const player = await newPlayer(db);
    const tag = randomUUID().slice(0, 6);
    const added = await addContestant(db, player, { name: `Test Jalapeño ${tag}`, ...(await testPicture("#15803d")) });

    for (const typed of [`test jalapeno ${tag}`, `TEST JALAPENO ${tag}`, `Test Jalapenno ${tag}`]) {
      const similar = await findSimilarContestants(db, typed);
      expect(similar.map((c) => c.id)).toContain(added.id);
    }
    expect((await findSimilarContestants(db, "Watermelon")).map((c) => c.id)).not.toContain(added.id);
    expect(await findSimilarContestants(db, "  ")).toEqual([]);
  });
});

async function addContestants(player: { playerId: string }, count: number) {
  const tag = randomUUID().slice(0, 6);
  const pictures = await testPicture("#6366f1");
  return Promise.all(
    Array.from({ length: count }, (_, i) => addContestant(db, player, { name: `Test ${tag} ${i + 1}`, ...pictures })),
  );
}

const categoryName = () => `Test category ${randomUUID().slice(0, 8)}`;

describe("categories", () => {
  it("are created with a name and a description of up to 280 characters, showing who added them", async () => {
    const player = await newPlayer(db);
    const name = categoryName();

    const { categoryId } = await createCategory(db, player, { name, description: "d".repeat(280) });

    const category = await getCategory(db, categoryId);
    expect(category).toMatchObject({ name, description: "d".repeat(280), contestants: [], cover: null });
    expect(category?.createdBy).toEqual({ id: player.playerId, displayName: player.displayName });
    await expect(createCategory(db, player, { name: categoryName(), description: "d".repeat(281) })).rejects.toThrow(
      CatalogError,
    );
  });

  it("grow when any player adds existing contestants, which can be played right away", async () => {
    const creator = await newPlayer(db);
    const other = await newPlayer(db);
    const { categoryId } = await createCategory(db, creator, { name: categoryName(), description: "" });
    const contestants = await addContestants(other, 4);

    for (const c of contestants) await addContestantToCategory(db, other, categoryId, c.id);

    const category = await getCategory(db, categoryId);
    expect(category?.contestants.map((c) => c.id).sort()).toEqual(contestants.map((c) => c.id).sort());
    await expect(addContestantToCategory(db, creator, categoryId, contestants[0].id)).rejects.toThrow(
      new CatalogError("That contestant is already in this category."),
    );
    const { tournamentId } = await startTournament(db, other, { categoryId, size: 4 });
    expect(tournamentId).toBeTruthy();
  });

  it("show the creator's chosen cover, or else their top contestant by rated score", async () => {
    const creator = await newPlayer(db);
    const { categoryId } = await createCategory(db, creator, { name: categoryName(), description: "" });
    const [a, b, c] = await addContestants(creator, 3);
    for (const x of [a, b]) await addContestantToCategory(db, creator, categoryId, x.id);
    for (let i = 0; i < 3; i++) await recordMatch(db, { winnerId: b.id, loserId: a.id, categoryId });
    await refreshGlobalRankings(db);

    expect((await getCategory(db, categoryId))?.cover?.id).toBe(a.id);
    expect((await listCategories(db)).find((x) => x.id === categoryId)?.cover?.id).toBe(a.id);

    for (let i = 0; i < 3; i++) await recordMatch(db, { winnerId: b.id, loserId: a.id, categoryId, rated: true });
    await refreshGlobalRankings(db);

    expect((await getCategory(db, categoryId))?.cover?.id).toBe(b.id);
    expect((await listCategories(db)).find((x) => x.id === categoryId)).toMatchObject({ contestantCount: 2, cover: { id: b.id } });

    await setCategoryCover(db, creator, categoryId, a.id);
    expect((await getCategory(db, categoryId))?.cover?.id).toBe(a.id);
    expect((await listCategories(db)).find((x) => x.id === categoryId)?.cover?.id).toBe(a.id);

    await expect(setCategoryCover(db, creator, categoryId, c.id)).rejects.toThrow(CatalogError);
    await expect(setCategoryCover(db, await newPlayer(db), categoryId, b.id)).rejects.toThrow(CatalogError);

    await setCategoryCover(db, creator, categoryId, null);
    expect((await getCategory(db, categoryId))?.cover?.id).toBe(b.id);
  });
});

describe("editing and deleting contestants", () => {
  it("lets the creator rename it and change its picture until its first rated match", async () => {
    const creator = await newPlayer(db);
    const [contestant, rival] = await addContestants(creator, 2);
    await recordMatch(db, { winnerId: contestant.id, loserId: rival.id, categoryId: null });
    const pictures = await testPicture("#f59e0b");

    await editContestant(db, creator, contestant.id, { name: "Test Renamed", ...pictures });

    const edited = await getContestant(db, contestant.id, creator);
    expect(edited).toMatchObject({ name: "Test Renamed", canEdit: true });
    expect(edited?.picture512Url).not.toBe(contestant.picture512Url);
    expect((await getContestant(db, contestant.id, await newPlayer(db)))?.canEdit).toBe(false);
    expect((await getContestant(db, contestant.id))?.canEdit).toBe(false);

    await recordMatch(db, { winnerId: rival.id, loserId: contestant.id, categoryId: null, rated: true });

    expect((await getContestant(db, contestant.id, creator))?.canEdit).toBe(false);
    await expect(editContestant(db, creator, contestant.id, { name: "Test Too late" })).rejects.toThrow(CatalogError);
    await expect(deleteContestant(db, creator, contestant.id)).rejects.toThrow(CatalogError);
  });

  it("never lets another player edit or delete it", async () => {
    const [contestant] = await addContestants(await newPlayer(db), 1);
    const other = await newPlayer(db);

    await expect(editContestant(db, other, contestant.id, { name: "Test Hijacked" })).rejects.toThrow(CatalogError);
    await expect(deleteContestant(db, other, contestant.id)).rejects.toThrow(CatalogError);
    expect((await getContestant(db, contestant.id))?.name).toBe(contestant.name);
  });

  it("lets the creator delete it before its first rated match, along with its unrated play", async () => {
    const creator = await newPlayer(db);
    const { categoryId } = await createCategory(db, creator, { name: categoryName(), description: "" });
    const contestants = await addContestants(creator, 4);
    for (const c of contestants) await addContestantToCategory(db, creator, categoryId, c.id);
    const visitor = newVisitor();
    const { tournamentId } = await startTournament(db, visitor, { categoryId, size: 4 });
    await recordMatch(db, { winnerId: contestants[0].id, loserId: contestants[1].id, categoryId });

    await deleteContestant(db, creator, contestants[0].id);

    expect(await getContestant(db, contestants[0].id)).toBeNull();
    expect((await getCategory(db, categoryId))?.contestants).toHaveLength(3);
    expect(await getTournament(db, visitor, tournamentId)).toBeNull();
  });

  it("lets the admin edit or delete any contestant, even after rated matches", async () => {
    const [contestant, rival] = await addContestants(await newPlayer(db), 2);
    await recordMatch(db, { winnerId: contestant.id, loserId: rival.id, categoryId: null, rated: true });
    const admin = await newPlayer(db);
    await makeAdmin(db, admin.playerId);

    expect((await getContestant(db, contestant.id, admin))?.canEdit).toBe(true);
    await editContestant(db, admin, contestant.id, { name: "Test Fixed by admin" });
    expect((await getContestant(db, contestant.id))?.name).toBe("Test Fixed by admin");
    await deleteContestant(db, admin, contestant.id);
    expect(await getContestant(db, contestant.id)).toBeNull();
  });
});

describe("editing categories", () => {
  it("lets the creator edit details until the category has 10 contestants, then only the admin", async () => {
    const creator = await newPlayer(db);
    const { categoryId } = await createCategory(db, creator, { name: categoryName(), description: "" });
    const contestants = await addContestants(creator, 10);
    for (const c of contestants.slice(0, 9)) await addContestantToCategory(db, creator, categoryId, c.id);

    const renamed = categoryName();
    await editCategory(db, creator, categoryId, { name: renamed, description: "Fixed" });
    expect(await getCategory(db, categoryId, creator)).toMatchObject({ name: renamed, description: "Fixed", canEdit: true });

    await addContestantToCategory(db, creator, categoryId, contestants[9].id);

    expect((await getCategory(db, categoryId, creator))?.canEdit).toBe(false);
    await expect(editCategory(db, creator, categoryId, { name: categoryName(), description: "" })).rejects.toThrow(
      CatalogError,
    );
    const admin = await newPlayer(db);
    await makeAdmin(db, admin.playerId);
    await editCategory(db, admin, categoryId, { name: renamed, description: "Admin fix" });
    expect((await getCategory(db, categoryId))?.description).toBe("Admin fix");
  });

  it("never lets another player edit it", async () => {
    const { categoryId } = await createCategory(db, await newPlayer(db), { name: categoryName(), description: "" });
    const other = await newPlayer(db);

    expect((await getCategory(db, categoryId, other))?.canEdit).toBe(false);
    await expect(editCategory(db, other, categoryId, { name: categoryName(), description: "" })).rejects.toThrow(
      CatalogError,
    );
  });
});
