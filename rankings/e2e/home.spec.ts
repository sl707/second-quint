import { expect, test } from "@playwright/test";

test("home page shows the app name from the database", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Second Quint Rankings");
});
