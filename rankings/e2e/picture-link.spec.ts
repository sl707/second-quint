import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { admin, deleteUser, signInAsNewUser } from "./auth-stub";

const users: string[] = [];
let site: Server;
let requests = 0;

test.beforeAll(async () => {
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#16a34a" } }).png().toBuffer();
  site = createServer((_, res) => {
    requests++;
    res.writeHead(200, { "content-type": "image/png" }).end(png);
  });
  await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
});

test.afterAll(async () => {
  site.closeAllConnections();
  await new Promise((resolve) => site.close(resolve));
  for (const id of users) await deleteUser(id);
});

test("a link to an internal address is refused with a clear message, and the form stays usable", async ({ page, context, baseURL }) => {
  const user = await signInAsNewUser(context, baseURL!);
  users.push(user.userId);
  await admin.from("players").insert({ user_id: user.userId, display_name: `Linker_${randomUUID().slice(0, 8)}` });

  await page.goto("/contestants/new");
  const { port } = site.address() as AddressInfo;
  await page.getByLabel("Or paste an image link").fill(`http://127.0.0.1:${port}/picture.png`);
  await page.getByRole("button", { name: "Copy picture" }).click();

  const refused = page.getByRole("alert").filter({ hasText: "Pictures can't be copied from that address." });
  await expect(refused).toBeVisible();
  expect(requests).toBe(0);
  await expect(page.getByRole("button", { name: "Copy picture" })).toBeEnabled();

  const square = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#7c3aed" } }).png().toBuffer();
  await page.getByLabel("Picture").setInputFiles({ name: "grape.png", mimeType: "image/png", buffer: square });
  await expect(page.getByRole("img", { name: "Picture preview" })).toBeVisible();
  await expect(refused).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add contestant" })).toBeEnabled();
});
