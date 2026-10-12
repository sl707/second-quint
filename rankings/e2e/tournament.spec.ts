import { expect, test } from "@playwright/test";

test("a signed-out visitor plays a full tournament to its tournament ranking", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Play a tournament" }).click();

  await page.getByRole("radio", { name: /Dog breeds/ }).check();
  await expect(page.getByLabel("Size")).toHaveValue("8");
  await page.getByLabel("Size").fill("5");
  await expect(page.getByRole("status")).toContainText("This tournament will be unrated.You're signed out.");
  await page.getByRole("button", { name: "Start tournament" }).click();

  await expect(page.getByText("5 matches left")).toBeVisible();
  await page.getByRole("button", { name: /^Pick / }).first().click();
  await expect(page.getByText("4 matches left")).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("5 matches left")).toBeVisible();

  await page.getByRole("button", { name: /^Pick / }).first().click();
  await expect(page.getByText("4 matches left")).toBeVisible();

  // Closing the tab and coming back resumes the tournament.
  const url = page.url();
  await page.goto("/tournaments/new");
  await page.getByRole("link", { name: /Resume/ }).first().click();
  await expect(page).toHaveURL(url);
  await expect(page.getByText("4 matches left")).toBeVisible();

  for (let left = 4; left > 0; left--) {
    await expect(page.getByText(`${left} match${left === 1 ? "" : "es"} left`)).toBeVisible();
    await page.getByRole("button", { name: /^Pick / }).first().click();
  }

  // The final pick can be taken back too, reopening the tournament.
  await expect(page.getByRole("heading", { name: "Tournament ranking" })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("1 match left")).toBeVisible();
  await page.getByRole("button", { name: /^Pick / }).first().click();

  await expect(page.getByRole("heading", { name: "Tournament ranking" })).toBeVisible();
  const ranking = page.getByRole("list", { name: "Tournament ranking" });
  for (const place of ["1st", "2nd", "3rd", "4th", "5th"]) await expect(ranking.getByText(place, { exact: true })).toBeVisible();
});

test("a visitor hand-picks a tournament's contestants, which makes it unrated", async ({ page }) => {
  await page.goto("/tournaments/new");
  await page.getByRole("radio", { name: /Dog breeds/ }).check();
  await page.getByRole("radio", { name: "Pick contestants" }).check();

  const start = page.getByRole("button", { name: "Start tournament" });
  for (const name of ["Corgi", "Poodle", "Beagle"]) await page.getByRole("checkbox", { name }).check();
  await expect(start).toBeDisabled();
  await page.getByRole("checkbox", { name: "Shiba Inu" }).check();
  await expect(page.getByRole("status")).toContainText("This tournament will be unrated.Hand-picked tournaments are always unrated.");
  await start.click();

  await expect(page.getByText("4 matches left")).toBeVisible();
  const picks = page.getByRole("button", { name: /^Pick / });
  await expect(picks).toHaveCount(2);
  for (const pick of await picks.all()) expect(await pick.getAttribute("aria-label")).toMatch(/Corgi|Poodle|Beagle|Shiba Inu/);
});
