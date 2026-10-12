import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, deleteUser, signInAsNewUser } from "./auth-stub";

const users: string[] = [];
test.afterAll(async () => {
  for (const id of users) await deleteUser(id);
});

test("a signed-out visitor plays Infinite Mode picks and a skip", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Play Infinite Mode" }).click();
  await page.getByRole("button", { name: /^Dog breeds/ }).click();

  await expect(page.getByRole("heading", { name: "Dog breeds" })).toBeVisible();
  await expect(page.getByText("Unrated", { exact: true })).toBeVisible();

  // Phone layout: the two contestants are stacked.
  const [first, second] = await page.getByRole("button", { name: /^Pick / }).all();
  const [top, bottom] = [await first.boundingBox(), await second.boundingBox()];
  expect(bottom!.y).toBeGreaterThanOrEqual(top!.y + top!.height);

  for (const picks of ["1 pick", "2 picks", "3 picks"]) {
    const pick = page.getByRole("button", { name: /^Pick / }).last();
    const name = (await pick.getAttribute("aria-label"))!.replace(/^Pick /, "");
    await pick.click();
    await expect(page.getByRole("status")).toContainText(`You picked ${name} over`);
    await expect(page.getByRole("status")).toContainText(`${picks} so far`);
  }

  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("status")).toContainText("Skipped.");
  await expect(page.getByRole("status")).toContainText("3 picks so far");
  await expect(page.getByRole("button", { name: /^Pick / })).toHaveCount(2);
});

test("a signed-in player plays rated with a skip counter, or chooses unrated", async ({ page, context, baseURL }) => {
  const user = await signInAsNewUser(context, baseURL!);
  users.push(user.userId);
  await admin.from("players").insert({ user_id: user.userId, display_name: `Player_${randomUUID().slice(0, 8)}` });

  await page.goto("/infinite");
  await page.getByRole("button", { name: /^Dog breeds/ }).click();
  const status = page.getByText(/rated skips left/);
  await expect(page.getByText("Rated", { exact: true })).toBeVisible();
  await expect(status).toContainText("5 of 5 rated skips left");
  const picksLeft = Number((await status.textContent())!.match(/(\d+) rated picks? left/)![1]);

  await page.getByRole("button", { name: "Skip" }).click();
  await expect(status).toContainText("4 of 5 rated skips left");
  await page.getByRole("button", { name: /^Pick / }).first().click();
  await expect(status).toContainText(`${picksLeft - 1} rated`);

  await page.goto("/infinite");
  await page.getByLabel(/Play unrated/).check();
  await page.getByRole("button", { name: /^Dog breeds/ }).click();
  await expect(page.getByText("Unrated", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play rated" })).toBeVisible();
});
