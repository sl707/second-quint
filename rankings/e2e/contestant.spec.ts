import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin } from "./auth-stub";

const categories: string[] = [];
const contestants: string[] = [];
test.afterAll(async () => {
  if (categories.length) await admin.from("categories").delete().in("id", categories);
  for (const id of contestants) await admin.rpc("delete_contestant", { p_contestant_id: id });
});

async function createCategory(name: string, contestantIds: string[]) {
  const { data: category } = await admin.from("categories").insert({ name }).select("id").single();
  categories.push(category!.id);
  await admin.from("category_memberships").insert(contestantIds.map((id) => ({ category_id: category!.id, contestant_id: id })));
  return category!.id as string;
}

test("a contestant page shows its rankings, record, head-to-head, and rating chart", async ({ page, request }) => {
  const tag = randomUUID().slice(0, 6);
  const { data: rows } = await admin
    .from("contestants")
    .insert(["Star", "Rival", "Underdog"].map((n) => ({ name: `E2E ${n} ${tag}`, picture_512_url: "/samples/apple-512.svg", picture_128_url: "/samples/apple-128.svg" })))
    .select("id, name");
  const [star, rival, underdog] = ["Star", "Rival", "Underdog"].map((n) => rows!.find((r) => r.name.startsWith(`E2E ${n}`))!);
  contestants.push(star.id, rival.id, underdog.id);
  const played = await createCategory(`E2E played ${tag}`, [star.id, rival.id, underdog.id]);
  const unplayed = `E2E unplayed ${tag}`;
  await createCategory(unplayed, [star.id]);

  const match = (winner: string, loser: string, rated: boolean) => ({
    winner_id: winner,
    loser_id: loser,
    category_id: played,
    rated,
    visitor_id: randomUUID(),
  });
  await admin.from("matches").insert([
    match(star.id, rival.id, true),
    match(star.id, rival.id, true),
    match(star.id, underdog.id, true),
    match(rival.id, star.id, false),
  ]);
  const refresh = await request.post("/api/rankings/refresh", {
    headers: { authorization: `Bearer ${process.env.RANKINGS_REFRESH_SECRET}` },
  });
  expect(refresh.status()).toBe(200);

  await page.goto(`/contestants/${star.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(star.name);
  await expect(page.getByRole("img", { name: star.name })).toBeVisible();

  const rankings = page.getByRole("list", { name: "Rankings" });
  const playedEntry = rankings.getByRole("listitem").filter({ hasText: `E2E played ${tag}` });
  await expect(playedEntry).toContainText("#1");
  await expect(playedEntry).toContainText("±");
  await expect(playedEntry.getByRole("img", { name: /Rating over time/ })).toBeVisible();
  await expect(rankings.getByRole("listitem").filter({ hasText: unplayed })).toContainText("Not yet judged");

  await expect(page.getByRole("region", { name: "Record" })).toContainText("3–0");
  const headToHead = page.getByRole("list", { name: "Head-to-head" });
  await expect(headToHead.getByRole("listitem").first()).toContainText(rival.name);
  await expect(headToHead.getByRole("listitem").first()).toContainText("2–0");

  await page.getByRole("navigation", { name: "Ranking version" }).getByRole("link", { name: "Unrated", exact: true }).click();
  await expect(page).toHaveURL(/version=unrated/);
  await expect(page.getByRole("region", { name: "Record" })).toContainText("3–1");
  await expect(headToHead.getByRole("listitem").first()).toContainText("2–1");
});
