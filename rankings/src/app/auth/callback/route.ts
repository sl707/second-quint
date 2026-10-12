import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/pathname";
import { createAdminClient } from "@/lib/supabase/admin";
import { createVisitorClient } from "@/lib/supabase/server";
import { findPlayerByUser } from "@/server/profiles";

/** Where Google sign-in lands: starts the session, then asks first-timers for a display name. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/?sign-in=failed", request.url));

  const { data, error } = await (await createVisitorClient()).auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/?sign-in=failed", request.url));

  const player = await findPlayerByUser(createAdminClient(), data.user.id);
  const target = player ? next : `/welcome?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(target, request.url));
}
