import { expect, test } from "@playwright/test";

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
