import { expect, test } from "@playwright/test";

test("the ranking refresher only runs with the shared secret", async ({ request }) => {
  expect((await request.post("/api/rankings/refresh")).status()).toBe(401);
  expect((await request.post("/api/rankings/refresh", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
});

test("a played match shows up in the category ranking after a refresh", async ({ page, request }) => {
  await page.goto("/tournaments/new");
  await page.getByRole("radio", { name: /Dog breeds/ }).check();
  await page.getByRole("button", { name: "Start tournament" }).click();
  await page.getByRole("button", { name: /^Pick / }).first().click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

  const refresh = await request.post("/api/rankings/refresh", {
    headers: { authorization: `Bearer ${process.env.RANKINGS_REFRESH_SECRET}` },
  });
  expect(refresh.status()).toBe(200);

  await page.goto("/");
  await page.getByRole("link", { name: "See rankings" }).click();
  await expect(page.getByRole("link", { name: /Overall Ranking/ })).toBeVisible();
  await page.getByRole("link", { name: "Dog breeds" }).click();

  await expect(page.getByRole("heading", { name: "Dog breeds" })).toBeVisible();
  const ranking = page.getByRole("list", { name: "Dog breeds" });
  await expect(ranking.getByRole("listitem").first()).toContainText("Score");
  await expect(ranking.getByRole("listitem").first()).toContainText("1");
});
