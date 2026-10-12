import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { isPublicAddress } from "@/domain/network/address";
import { MAX_PICTURE_BYTES, sniffPictureType, type AcceptedPictureType } from "@/domain/picture/picture";

/** The link can't be copied; the message is safe to show to the player. */
export class PictureLinkError extends Error {}

export type CopiedPicture = { bytes: Uint8Array; type: AcceptedPictureType };

export type PictureLinkOptions = {
  /** Finds a host name's addresses; defaults to the system resolver. */
  resolveHost?: (hostname: string) => Promise<string[]>;
  /** Non-public addresses to treat as public anyway (tests stand a local server in for a site). */
  trustedAddresses?: string[];
  /** For the whole copy, redirects included. */
  timeoutMs?: number;
};

export const MAX_LINK_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_LINK_LENGTH = 2048;

const systemResolve = async (hostname: string) => (await lookup(hostname, { all: true })).map((a) => a.address);

function parseLink(link: string): URL {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    throw new PictureLinkError("That isn't a valid link.");
  }
  if (link.length > MAX_LINK_LENGTH) throw new PictureLinkError("That link is too long.");
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new PictureLinkError("Links must start with http:// or https://.");
  if (url.username || url.password) throw new PictureLinkError("Links can't include a user name or password.");
  return url;
}

/**
 * The address to connect to for `url`, after checking every address its host has is public: a
 * host with any internal address is refused, so it can't switch to one between check and connect.
 */
async function checkedAddress(url: URL, options: PictureLinkOptions): Promise<string> {
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  const literal = /^[\d.]+$/.test(host) || host.includes(":");
  let addresses: string[];
  if (literal) {
    addresses = [host];
  } else {
    try {
      addresses = await (options.resolveHost ?? systemResolve)(host);
    } catch {
      addresses = [];
    }
    if (!addresses.length) throw new PictureLinkError("That site couldn't be found.");
  }
  const trusted = options.trustedAddresses ?? [];
  if (!addresses.every((a) => isPublicAddress(a) || trusted.includes(a))) {
    throw new PictureLinkError("Pictures can't be copied from that address.");
  }
  return addresses[0];
}

type Hop = { redirect: URL } | { picture: CopiedPicture };

function request(url: URL, address: string, signal: AbortSignal): Promise<Hop> {
  const family = address.includes(":") ? 6 : 4;
  // Connects to the address that was checked, never a fresh lookup.
  const pinned: LookupFunction = (_hostname, opts, callback) => {
    if (opts.all) (callback as (e: null, a: { address: string; family: number }[]) => void)(null, [{ address, family }]);
    else callback(null, address, family);
  };
  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      { lookup: pinned, signal, headers: { accept: "image/jpeg, image/png, image/webp, image/gif", "user-agent": "SecondQuintRankings" } },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.destroy();
          try {
            resolve({ redirect: new URL(res.headers.location, url) });
          } catch {
            reject(new PictureLinkError("That link redirects somewhere invalid."));
          }
          return;
        }
        if (status < 200 || status >= 300) {
          res.destroy();
          reject(new PictureLinkError(`That link didn't work (the site answered ${status}).`));
          return;
        }
        if (Number(res.headers["content-length"]) > MAX_PICTURE_BYTES) {
          res.destroy();
          reject(new PictureLinkError("That picture is over 5 MB."));
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_PICTURE_BYTES) {
            reject(new PictureLinkError("That picture is over 5 MB."));
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const bytes = new Uint8Array(Buffer.concat(chunks));
          const type = sniffPictureType(bytes);
          if (!type) reject(new PictureLinkError("That link isn't a JPG, PNG, WebP, or GIF picture."));
          else resolve({ picture: { bytes, type } });
        });
        res.on("error", reject);
        res.on("close", () => {
          if (!res.complete) reject(new Error("The response ended early."));
        });
      },
    );
    req.on("error", reject);
  });
}

/**
 * Fetches a picture from a link a player pasted, for the browser to resize like an upload: only
 * public addresses (re-checked on every redirect), at most 5 MB, JPG/PNG/WebP/GIF by their bytes.
 */
export async function fetchPictureFromLink(link: string, options: PictureLinkOptions = {}): Promise<CopiedPicture> {
  let url = parseLink(link);
  const signal = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    for (let redirects = 0; ; redirects++) {
      const hop = await request(url, await checkedAddress(url, options), signal);
      if ("picture" in hop) return hop.picture;
      if (redirects === MAX_LINK_REDIRECTS) throw new PictureLinkError("That link redirects too many times.");
      url = parseLink(hop.redirect.href);
    }
  } catch (error) {
    if (error instanceof PictureLinkError) throw error;
    if (signal.aborted) throw new PictureLinkError("That site took too long to send the picture.");
    throw new PictureLinkError("That link couldn't be reached.");
  }
}
