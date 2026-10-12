import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { admin, deleteUser, signInAsNewUser } from "./auth-stub";

const users: string[] = [];
const categories: string[] = [];
const contestants: string[] = [];
test.afterAll(async () => {
  if (categories.length) await admin.from("categories").delete().in("id", categories);
  const pictures: string[] = [];
  for (const id of contestants) {
    const { data } = await admin.rpc("delete_contestant", { p_contestant_id: id });
    for (const url of (data ?? []) as string[]) pictures.push(url.split("/pictures/").pop()!);
  }
  if (pictures.length) await admin.storage.from("pictures").remove(pictures);
  for (const id of users) await deleteUser(id);
});

test("a player creates a category, adds a new contestant with a picture, adds an existing one, and picks the cover", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await signInAsNewUser(context, baseURL!);
  users.push(user.userId);
  const displayName = `Maker_${randomUUID().slice(0, 8)}`;
  await admin.from("players").insert({ user_id: user.userId, display_name: displayName });

  await page.goto("/categories");
  await page.getByRole("link", { name: "Create a category" }).click();
  const categoryName = `E2E category ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Name").fill(categoryName);
  await page.getByLabel("Description").fill("Toppings, tested.");
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(categoryName);
  categories.push(page.url().split("/").pop()!);
  await expect(page.getByText(`Added by ${displayName}`)).toBeVisible();

  // A new contestant, straight into the category.
  await page.getByRole("link", { name: "Add a new contestant" }).click();
  await page.getByLabel("Name").fill("Pepperonni");
  await expect(page.getByRole("region", { name: "Similar contestants" }).getByRole("link", { name: "Pepperoni" })).toBeVisible();
  const contestantName = `E2E Pepper ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Name").fill(contestantName);
  const wide = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#dc2626" } }).png().toBuffer();
  await page.getByLabel("Picture").setInputFiles({ name: "pepper.png", mimeType: "image/png", buffer: wide });
  await expect(page.getByRole("img", { name: "Picture preview" })).toBeVisible();
  await page.getByRole("button", { name: "Add contestant" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(categoryName);
  const list = page.getByRole("list", { name: /contestants/ });
  await expect(list.getByRole("link", { name: contestantName })).toBeVisible();

  const { data: added } = await admin
    .from("contestants")
    .select("id, picture_512_url, picture_128_url")
    .eq("name", contestantName)
    .single();
  contestants.push(added!.id);
  for (const [url, size] of [
    [added!.picture_512_url, 512],
    [added!.picture_128_url, 128],
  ] as const) {
    const stored = await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).metadata();
    expect({ format: stored.format, width: stored.width, height: stored.height }).toEqual({ format: "webp", width: size, height: size });
  }

  // An existing contestant, found by name.
  await page.getByLabel("Find a contestant").fill("Mushroom");
  await page.getByRole("button", { name: "Add Mushroom" }).click();
  await expect(list.getByRole("link", { name: "Mushroom" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2 contestants" })).toBeVisible();

  await page.getByRole("button", { name: "Make Mushroom the cover" }).click();
  await expect(page.getByRole("img", { name: "Cover: Mushroom" })).toBeVisible();

  // The new contestant's page shows who added it, linking to their profile.
  await list.getByRole("link", { name: contestantName }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(contestantName);
  await page.getByRole("link", { name: displayName }).last().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(displayName);
});
