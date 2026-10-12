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
  await expect(page.getByRole("timer")).toHaveText(/^\d+h \d\dm \d\ds$/);
  await expect(page.getByRole("radio", { name: /Dog breeds/ })).toHaveAccessibleName(/20 of 20 rated matches left today/);
  await page.getByLabel("Play unrated").check();
  await expect(page.getByRole("status")).toContainText("This tournament will be unrated.You chose to play unrated.");
  await page.getByLabel("Play unrated").uncheck();
  await expect(page.getByRole("status")).toContainText("This tournament will be rated.");
  await page.getByRole("button", { name: "Start tournament" }).click();
  await expect(page.getByText("4 matches left")).toBeVisible();
  await expect(page.getByText("Rated", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Pick / }).first().click();
  await expect(page.getByText("3 matches left")).toBeVisible();

  const tournamentId = page.url().split("/").pop()!;
  const { data: player } = await admin.from("players").select("id").eq("user_id", user.userId).single();
  const { data: matches } = await admin.from("matches").select("player_id, visitor_id, rated").eq("tournament_id", tournamentId);
  expect(matches).toEqual([{ player_id: player!.id, visitor_id: null, rated: true }]);

  await page.goto("/tournaments/new");
  await page.getByRole("radio", { name: /Dog breeds/ }).check();
  await expect(page.getByRole("radio", { name: /Dog breeds/ })).toHaveAccessibleName(/16 of 20 rated matches left today/);
  await expect(page.getByRole("status")).toContainText("You already have an unfinished rated tournament.");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});

test("anyone can see a player's personal rankings and past tournaments on their profile", async ({ page, context, baseURL }) => {
  const user = await signInAsNewUser(context, baseURL!);
  users.push(user.userId);
  const displayName = `Player_${randomUUID().slice(0, 8)}`;
  await admin.from("players").insert({ user_id: user.userId, display_name: displayName });

  await page.goto("/tournaments/new");
  await page.getByRole("radio", { name: /Dog breeds/ }).check();
  await page.getByLabel("Size").fill("4");
  await page.getByRole("button", { name: "Start tournament" }).click();
  for (const left of [3, 2, 1]) {
    await page.getByRole("button", { name: /^Pick / }).first().click();
    await expect(page.getByText(`${left} ${left === 1 ? "match" : "matches"} left`)).toBeVisible();
  }
  await page.getByRole("button", { name: /^Pick / }).first().click();
  await expect(page.getByText("Finished", { exact: true })).toBeVisible();

  await page.goto("/tournaments/new");
  await page.getByRole("radio", { name: /Dog breeds/ }).check();
  await page.getByLabel("Size").fill("4");
  await page.getByLabel("Play unrated").check();
  await page.getByRole("button", { name: "Start tournament" }).click();
  await page.getByRole("button", { name: /^Pick / }).first().click();
  await expect(page.getByText("3 matches left")).toBeVisible();

  // Straight away, without a ranking refresh, and signed out.
  const stranger = await context.browser()!.newPage();
  await stranger.goto(`/players/${displayName}`);
  const versions = stranger.getByRole("navigation", { name: "Ranking version" });
  await expect(versions.getByRole("link", { name: "Rated", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(stranger.getByRole("list", { name: "Overall Ranking" }).getByRole("listitem")).toHaveCount(4);
  await expect(stranger.getByRole("heading", { name: "Not yet judged" })).toBeVisible();

  await stranger.getByRole("navigation", { name: "Personal ranking scope" }).getByRole("link", { name: "Dog breeds" }).click();
  await expect(stranger.getByRole("list", { name: "Dog breeds" }).getByRole("listitem")).toHaveCount(4);
  await versions.getByRole("link", { name: "Unrated", exact: true }).click();
  await expect(stranger).toHaveURL(/scope=.*version=unrated/);
  await expect(versions.getByRole("link", { name: "Unrated", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(stranger.getByRole("list", { name: "Dog breeds" }).getByRole("listitem").first()).toContainText("Score");

  const past = stranger.getByRole("list", { name: "Past tournaments" }).getByRole("listitem").filter({ hasText: "Dog breeds" });
  await expect(past.first()).toContainText(/Unrated.*In progress/);
  await expect(past.nth(1)).toContainText(/Rated.*Winner: /);
  await past.nth(1).getByText(/Winner: /).click();
  await expect(past.nth(1).getByRole("list", { name: "Tournament ranking" }).getByRole("listitem")).toHaveText([/^1st/, /^2nd/, /^3rd/, /^4th/]);
  await stranger.close();
});

test("a player is reminded of an unfinished rated tournament, resumes it, and gives it up", async ({ page, context, baseURL }) => {
  const user = await signInAsNewUser(context, baseURL!);
  users.push(user.userId);
  const displayName = `Player_${randomUUID().slice(0, 8)}`;
  await admin.from("players").insert({ user_id: user.userId, display_name: displayName });

  await page.goto("/tournaments/new");
  await page.getByRole("radio", { name: /Dog breeds/ }).check();
  await page.getByLabel("Size").fill("4");
  await page.getByRole("button", { name: "Start tournament" }).click();
  await page.getByRole("button", { name: /^Pick / }).first().click();
  await expect(page.getByText("3 matches left")).toBeVisible();
  const tournamentUrl = page.url();

  await page.goto(`/players/${displayName}`);
  await expect(page.getByRole("link", { name: /Dog breeds.*Rated.*Resume · 3 left/ })).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: /Dog breeds.*Rated.*Resume · 3 left/ }).click();
  await expect(page).toHaveURL(tournamentUrl);

  await page.getByText("Give up", { exact: true }).click();
  await page.getByRole("button", { name: "Give up this tournament" }).click();
  await expect(page.getByText("Given up", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pick / })).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Unfinished tournaments" })).toHaveCount(0);
  await page.goto("/tournaments/new");
  await page.getByRole("radio", { name: /Dog breeds/ }).check();
  await page.getByLabel("Size").fill("4");
  await expect(page.getByRole("radio", { name: /Dog breeds/ })).toHaveAccessibleName(/16 of 20 rated matches left today/);
  await expect(page.getByRole("status")).toContainText("This tournament will be rated.");
});
