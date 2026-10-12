import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { CatalogError, copyPictureFromLink, type PictureLinkOptions } from "@/server/catalog";
import { newPlayer, removeTestData } from "./fixtures";

const db = createAdminClient();

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
const routes = new Map<string, Handler>();
const requests: string[] = [];
let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((req, res) => {
    requests.push(req.url!);
    const handler = routes.get(req.url!);
    if (handler) handler(req, res);
    else res.writeHead(404).end("not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await removeTestData(db);
});

/** The local test server stands in for a public site: only its address is trusted. */
const asPublicSite: PictureLinkOptions = { trustedAddresses: ["127.0.0.1"] };
const local = (path: string) => `http://127.0.0.1:${port}${path}`;

let routeCount = 0;
function route(handler: Handler): string {
  const path = `/r${++routeCount}`;
  routes.set(path, handler);
  return path;
}
const serve = (body: Uint8Array | string, headers: Record<string, string | number> = {}) =>
  route((_, res) => res.writeHead(200, headers).end(body));

const png = async () =>
  new Uint8Array(await sharp({ create: { width: 40, height: 30, channels: 3, background: "#2563eb" } }).png().toBuffer());

describe("copying a picture from a link", () => {
  it("hands back the picture's bytes and type, read from the bytes", async () => {
    const player = await newPlayer(db);
    const picture = await png();
    const path = serve(picture, { "content-type": "application/octet-stream" });

    const copied = await copyPictureFromLink(db, player, local(path), asPublicSite);

    expect(copied.type).toBe("image/png");
    expect(copied.bytes).toEqual(picture);
  });

  it("connects to the address it checked for a host name, and follows a few redirects", async () => {
    const player = await newPlayer(db);
    const picture = await png();
    const target = serve(picture, { "content-type": "image/png" });
    const hop2 = route((_, res) => res.writeHead(301, { location: target }).end());
    const hop1 = route((_, res) => res.writeHead(302, { location: `http://pictures.test:${port}${hop2}` }).end());
    const options = { ...asPublicSite, resolveHost: async (host: string) => (host === "pictures.test" ? ["127.0.0.1"] : []) };

    const copied = await copyPictureFromLink(db, player, `http://pictures.test:${port}${hop1}`, options);

    expect(copied.bytes).toEqual(picture);
  });

  it("refuses private, loopback, and link-local addresses without contacting them", async () => {
    const player = await newPlayer(db);
    const path = serve(await png(), { "content-type": "image/png" });
    const before = requests.length;

    for (const link of [
      local(path),
      `http://localhost:${port}${path}`,
      `http://2130706433:${port}${path}`,
      `http://0x7f.1:${port}${path}`,
      `http://[::1]:${port}${path}`,
      `http://[::ffff:127.0.0.1]:${port}${path}`,
      "http://169.254.169.254/latest/meta-data/",
      "http://10.0.0.1/picture.png",
      "http://[fe80::1]/picture.png",
    ]) {
      await expect(copyPictureFromLink(db, player, link), link).rejects.toThrow("Pictures can't be copied from that address.");
    }
    expect(requests.length).toBe(before);
  });

  it("refuses a host name that resolves to an internal address", async () => {
    const player = await newPlayer(db);
    const resolveHost = async (host: string) =>
      ({ "intranet.test": ["10.0.0.5"], "mixed.test": ["93.184.216.34", "127.0.0.1"], "v6.test": ["fd00::1"] })[host] ?? [];

    for (const host of ["intranet.test", "mixed.test", "v6.test"]) {
      await expect(copyPictureFromLink(db, player, `http://${host}/a.png`, { resolveHost }), host).rejects.toThrow(
        "Pictures can't be copied from that address.",
      );
    }
  });

  it("re-checks the address on every redirect", async () => {
    const player = await newPlayer(db);
    const target = serve(await png(), { "content-type": "image/png" });
    const resolveHost = async (host: string) => (host === "intranet.test" ? ["10.0.0.5"] : []);
    const before = requests.length;

    for (const location of [`http://[::1]:${port}${target}`, `http://intranet.test:${port}${target}`, "http://169.254.169.254/"]) {
      const hop = route((_, res) => res.writeHead(302, { location }).end());
      await expect(copyPictureFromLink(db, player, local(hop), { ...asPublicSite, resolveHost }), location).rejects.toThrow(
        "Pictures can't be copied from that address.",
      );
    }
    expect(requests.length - before).toBe(3);
  });

  it("refuses a link that redirects too many times", async () => {
    const player = await newPlayer(db);
    let next = serve(await png(), { "content-type": "image/png" });
    for (let i = 0; i < 4; i++) {
      const location = next;
      next = route((_, res) => res.writeHead(302, { location }).end());
    }

    await expect(copyPictureFromLink(db, player, local(next), asPublicSite)).rejects.toThrow("redirects too many times");
  });

  it("refuses files over 5 MB, whether or not the site says their size up front", async () => {
    const player = await newPlayer(db);
    const huge = new Uint8Array(5 * 1024 * 1024 + 1);
    huge.set(await png());
    const declared = serve(huge, { "content-type": "image/png", "content-length": huge.length });
    let sent = 0;
    const streamed = route((_, res) => {
      res.writeHead(200, { "content-type": "image/png" });
      const chunk = new Uint8Array(64 * 1024);
      const write = () => {
        while (sent < 20 * 1024 * 1024 && !res.destroyed) {
          sent += chunk.length;
          if (!res.write(chunk)) return res.once("drain", write);
        }
        res.end();
      };
      write();
    });

    await expect(copyPictureFromLink(db, player, local(declared), asPublicSite)).rejects.toThrow("over 5 MB");
    await expect(copyPictureFromLink(db, player, local(streamed), asPublicSite)).rejects.toThrow("over 5 MB");
    expect(sent).toBeLessThan(20 * 1024 * 1024);
  });

  it("refuses content that isn't a JPG, PNG, WebP, or GIF, whatever type the site claims", async () => {
    const player = await newPlayer(db);
    const html = serve("<!doctype html><title>Not a picture</title>", { "content-type": "image/png" });
    const svg = serve('<svg xmlns="http://www.w3.org/2000/svg"/>', { "content-type": "image/svg+xml" });
    const tiff = serve(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).tiff().toBuffer(), {
      "content-type": "image/tiff",
    });

    for (const path of [html, svg, tiff]) {
      await expect(copyPictureFromLink(db, player, local(path), asPublicSite)).rejects.toThrow(
        "That link isn't a JPG, PNG, WebP, or GIF picture.",
      );
    }
  });

  it("refuses broken links, other kinds of link, and sites that take too long", async () => {
    const player = await newPlayer(db);
    const slow = route(() => {});
    const stalls = route((_, res) => res.writeHead(200, { "content-type": "image/png" }).write("\x89PNG"));

    await expect(copyPictureFromLink(db, player, local("/missing"), asPublicSite)).rejects.toThrow("404");
    await expect(copyPictureFromLink(db, player, "not a link")).rejects.toThrow("That isn't a valid link.");
    await expect(copyPictureFromLink(db, player, "file:///etc/passwd")).rejects.toThrow("http:// or https://");
    for (const path of [slow, stalls]) {
      await expect(copyPictureFromLink(db, player, local(path), { ...asPublicSite, timeoutMs: 300 })).rejects.toThrow(
        "took too long",
      );
    }
  });

  it("is only for signed-in players who aren't banned", async () => {
    const player = await newPlayer(db);
    await db.from("players").update({ banned: true }).eq("id", player.playerId);
    const path = serve(await png(), { "content-type": "image/png" });
    const before = requests.length;

    await expect(copyPictureFromLink(db, player, local(path), asPublicSite)).rejects.toThrow(CatalogError);
    await expect(
      copyPictureFromLink(db, { playerId: "00000000-0000-4000-8000-000000000001" }, local(path), asPublicSite),
    ).rejects.toThrow(CatalogError);
    expect(requests.length).toBe(before);
  });
});
