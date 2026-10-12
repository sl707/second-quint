import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, deleteUser, signInAsNewUser } from "./auth-stub";

const users: string[] = [];
const categories: string[] = [];
const contestants: string[] = [];
test.afterAll(async () => {
  if (contestants.length) await admin.from("reports").delete().in("target_id", contestants);
  if (categories.length) await admin.from("categories").delete().in("id", categories);
  for (const id of contestants) await admin.rpc("delete_contestant", { p_contestant_id: id });
  for (const id of users) await deleteUser(id);
});

test("a visitor reports a contestant, and the admin resolves it and removes the contestant from its category", async ({
  page,
  browser,
  baseURL,
}) => {
  const tag = randomUUID().slice(0, 6);
  const { data: rows } = await admin
    .from("contestants")
    .insert(["Offtopic", "Fine"].map((n) => ({ name: `E2E ${n} ${tag}`, picture_512_url: "/samples/apple-512.svg", picture_128_url: "/samples/apple-128.svg" })))
    .select("id, name");
  const [offtopic, fine] = ["Offtopic", "Fine"].map((n) => rows!.find((r) => r.name.startsWith(`E2E ${n}`))!);
  contestants.push(offtopic.id, fine.id);
  const { data: category } = await admin.from("categories").insert({ name: `E2E moderated ${tag}` }).select("id").single();
  categories.push(category!.id);
  await admin.from("category_memberships").insert([offtopic, fine].map((c) => ({ category_id: category!.id, contestant_id: c.id })));

  // A signed-out visitor reports it.
  await page.goto(`/contestants/${offtopic.id}`);
  await page.getByText("Report", { exact: true }).click();
  await page.getByLabel(`What's wrong with ${offtopic.name}?`).fill("Not part of this category");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByRole("status")).toHaveText("Thanks, the admin will take a look.");

  // Only the admin has an admin page.
  expect((await page.goto("/admin"))?.status()).toBe(404);

  const context = await browser.newContext({ baseURL });
  const adminPage = await context.newPage();
  const user = await signInAsNewUser(context, baseURL!);
  users.push(user.userId);
  await admin.from("players").insert({ user_id: user.userId, display_name: `Admin_${tag}`, is_admin: true });

  await adminPage.goto("/");
  await adminPage.getByRole("link", { name: "Admin", exact: true }).click();
  const report = adminPage.getByRole("listitem").filter({ hasText: "Not part of this category" });
  await expect(report.getByRole("link", { name: offtopic.name })).toBeVisible();
  await expect(report).toContainText("By a signed-out visitor");
  await report.getByRole("button", { name: "Resolve" }).click();
  await expect(report).toHaveCount(0);

  await adminPage.goto(`/categories/${category!.id}`);
  await adminPage.getByRole("button", { name: `Remove ${offtopic.name} from this category` }).click();
  const list = adminPage.getByRole("list", { name: /contestants/ });
  await expect(list.getByRole("link", { name: fine.name })).toBeVisible();
  await expect(list.getByRole("link", { name: offtopic.name })).toHaveCount(0);
  await context.close();
});

test("the admin renames a player and bans them, removing their matches", async ({ page, baseURL }) => {
  const tag = randomUUID().slice(0, 6);
  const { data: target } = await admin.auth.admin.createUser({ email: `e2e-rude-${tag}@example.test`, email_confirm: true });
  users.push(target.user!.id);
  const { data: player } = await admin
    .from("players")
    .insert({ user_id: target.user!.id, display_name: `Rude_${tag}` })
    .select("id")
    .single();
  const user = await signInAsNewUser(page.context(), baseURL!);
  users.push(user.userId);
  await admin.from("players").insert({ user_id: user.userId, display_name: `Admin_${tag}`, is_admin: true });

  await page.goto(`/players/Rude_${tag}`);
  await page.getByLabel("Display name").fill(`Fixed_${tag}`);
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(page).toHaveURL(`/players/Fixed_${tag}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Fixed_${tag}`);

  await page.getByLabel("Also remove their matches from all rankings").check();
  await page.getByRole("button", { name: `Ban Fixed_${tag}` }).click();
  await expect(page.getByText(`Fixed_${tag} is banned`)).toBeVisible();
  const { data: row } = await admin.from("players").select("banned").eq("id", player!.id).single();
  expect(row!.banned).toBe(true);

  await page.getByRole("button", { name: `Unban Fixed_${tag}` }).click();
  await expect(page.getByRole("button", { name: `Ban Fixed_${tag}` })).toBeVisible();
});

test("the admin merges a duplicate contestant, and its page then shows the survivor", async ({ page, baseURL }) => {
  const tag = randomUUID().slice(0, 6);
  const { data: rows } = await admin
    .from("contestants")
    .insert(["Duplicate", "Survivor"].map((n) => ({ name: `E2E ${n} ${tag}`, picture_512_url: "/samples/apple-512.svg", picture_128_url: "/samples/apple-128.svg" })))
    .select("id, name");
  const [duplicate, survivor] = ["Duplicate", "Survivor"].map((n) => rows!.find((r) => r.name.startsWith(`E2E ${n}`))!);
  contestants.push(duplicate.id, survivor.id);
  const user = await signInAsNewUser(page.context(), baseURL!);
  users.push(user.userId);
  await admin.from("players").insert({ user_id: user.userId, display_name: `Admin_${tag}`, is_admin: true });

  await page.goto("/admin");
  await page.getByLabel("Duplicate (contestant link or ID)").fill(`${baseURL}/contestants/${duplicate.id}`);
  await page.getByLabel("Survivor (contestant link or ID)").fill(survivor.id);
  await page.getByRole("button", { name: "Review merge" }).click();
  await page.getByRole("button", { name: `Merge ${duplicate.name} into ${survivor.name}` }).click();
  await expect(page).toHaveURL(`/contestants/${survivor.id}`);

  await page.goto(`/contestants/${duplicate.id}`);
  await expect(page).toHaveURL(`/contestants/${survivor.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(survivor.name);
});
