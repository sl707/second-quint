import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshGlobalRankings } from "@/server/rankings";

export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.RANKINGS_REFRESH_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || !given) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(secret));
}

/** Called by Supabase pg_cron every 5 minutes, with the shared secret as a bearer token. */
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await refreshGlobalRankings(createAdminClient());
  return Response.json(result);
}
