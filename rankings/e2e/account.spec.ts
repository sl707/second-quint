import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, deleteUser, signInAsNewUser } from "./auth-stub";

const users: string[] = [];
test.afterAll(async () => {
  for (const id of users) await deleteUser(id);
});

test("signing in with Google starts at Google and comes back to the callback", async ({ page }) => {
  await page.route("**/auth/v1/authorize**", (route) => route.fulfill({ body: "Google stand-in" }));
  await page.goto("/tournaments/new");

  const authorize = page.waitForRequest("**/auth/v1/authorize**");
  await page.getByRole("button", { name: "Sign in with Google" }).click();

  const target = new URL((await authorize).url());
  expect(target.searchParams.get("provider")).toBe("google");
  expect(target.searchParams.get("redirect_to")).toMatch(/\/auth\/callback\?next=%2Ftournaments%2Fnew$/);
});

test("a new player picks a display name, sees their profile, plays signed in, and signs out", async ({
  page,
  context,
  baseURL,
}) => {
  const taken = `Taken_${randomUUID().slice(0, 8)}`;
  const other = await admin.auth.admin.createUser({ email: `e2e-${randomUUID()}@example.test`, email_confirm: true });
  users.push(other.data.user!.id);
  await admin.from("players").insert({ user_id: other.data.user!.id, display_name: taken });

  const user = await signInAsNewUser(context, baseURL!);
  users.push(user.userId);

  // First sign-in: any page sends the player to choose a display name.
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome/);
  await page.getByLabel("Display name").fill(taken.toLowerCase());
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("That display name is taken.");

  const displayName = `Player_${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Display name").fill(displayName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Second Quint Rankings");

  await page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: displayName }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(displayName);
  const html = await page.content();
  expect(html).not.toContain(user.email);
  expect(html).not.toContain(user.fullName);

  // Profiles are public at a stable address.
  const profileUrl = page.url();
  const stranger = await context.browser()!.newPage();
  await stranger.goto(profileUrl);
  await expect(stranger.getByRole("heading", { level: 1 })).toHaveText(displayName);
  await stranger.close();

  await page.goto("/tournaments/new");
  await page.getByRole("radio", { name: /Dog breeds/ }).check();
  await page.getByLabel("Size").fill("4");
  await page.getByRole("button", { name: "Start tournament" }).click();
  await expect(page.getByText("4 matches left")).toBeVisible();
  await page.getByRole("button", { name: /^Pick / }).first().click();
  await expect(page.getByText("3 matches left")).toBeVisible();

  const tournamentId = page.url().split("/").pop()!;
  const { data: player } = await admin.from("players").select("id").eq("user_id", user.userId).single();
  const { data: matches } = await admin.from("matches").select("player_id, visitor_id").eq("tournament_id", tournamentId);
  expect(matches).toEqual([{ player_id: player!.id, visitor_id: null }]);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});
