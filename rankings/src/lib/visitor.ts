import "server-only";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { cookies, headers } from "next/headers";
import type { Visitor } from "@/server/game";

const COOKIE = "sq_visitor";
const ONE_YEAR = 60 * 60 * 24 * 365;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-out visitor from their cookie, or null if this browser hasn't played yet. */
export async function readVisitor(): Promise<Visitor | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  return value && UUID.test(value) ? { visitorId: value } : null;
}

/** The browser's IP as the host reports it (Vercel overwrites `x-forwarded-for`), or null if unknown. */
export async function readClientIp(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return ip && isIP(ip) ? ip : null;
}

/** Like readVisitor, but gives the browser a new anonymous visitor ID if it has none. Server Functions only. */
export async function ensureVisitor(): Promise<Visitor> {
  const existing = await readVisitor();
  if (existing) return existing;
  const visitorId = randomUUID();
  (await cookies()).set(COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: (await headers()).get("x-forwarded-proto") === "https",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return { visitorId };
}
