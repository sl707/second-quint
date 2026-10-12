import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { admin, deleteUser, signInAsNewUser } from "./auth-stub";

const users: string[] = [];
test.afterAll(async () => {
  for (const id of users) await deleteUser(id);
});

/** Fails with every element whose text doesn't meet AA contrast against what's behind it. */
async function expectReadable(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  const failures = violations.flatMap((v) => v.nodes.map((n) => `${page.url()} ${n.target.join(" ")}: ${n.failureSummary}`));
  expect(failures).toEqual([]);
}

test("the main pages pass axe's color-contrast check", async ({ page, context, baseURL }) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const user = await signInAsNewUser(context, baseURL!);
  users.push(user.userId);
  const displayName = `Contrast_${randomUUID().slice(0, 8)}`;
  await admin.from("players").insert({ user_id: user.userId, display_name: displayName, is_admin: true });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectReadable(page);

  // Tournament play, with one match decided so the bracket shows a winner and a loser.
  await page.goto("/tournaments/new");
  await page.getByRole("radio", { name: /Dog breeds/ }).check();
  await page.getByLabel("Size").fill("4");
  await page.getByLabel("Play unrated").check();
  await page.getByRole("button", { name: "Start tournament" }).click();
  await page.getByRole("button", { name: /^Pick / }).first().click();
  await expect(page.getByText("3 matches left")).toBeVisible();
  await expectReadable(page);

  await page.goto("/infinite");
  await page.getByRole("button", { name: /^Dog breeds/ }).click();
  await expect(page.getByRole("button", { name: /^Pick / })).toHaveCount(2);
  await expectReadable(page);

  await page.goto("/rankings/overall?version=unrated");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectReadable(page);

  const { data: contestant } = await admin.from("contestants").select("id").eq("name", "Corgi").limit(1).single();
  await page.goto(`/contestants/${contestant!.id}?version=unrated`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Corgi");
  await expectReadable(page);

  await page.goto(`/players/${displayName}?version=unrated`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(displayName);
  await expectReadable(page);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin");
  await expectReadable(page);
});
