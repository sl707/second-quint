import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { PATHNAME_HEADER } from "@/lib/pathname";
import { parseVariant, VARIANT_COOKIE, VARIANT_HEADER } from "@/lib/prototype-variant";

/** Refreshes the Supabase session cookies before rendering, since Server Components can't set cookies. */
export async function proxy(request: NextRequest) {
  const queryVariant = parseVariant(request.nextUrl.searchParams.get("variant"));
  const variant = queryVariant ?? parseVariant(request.cookies.get(VARIANT_COOKIE)?.value) ?? "current";
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set(PATHNAME_HEADER, request.nextUrl.pathname);
    headers.set(VARIANT_HEADER, variant);
    const next = NextResponse.next({ request: { headers } });
    if (queryVariant) next.cookies.set(VARIANT_COOKIE, queryVariant, { path: "/", sameSite: "lax" });
    return next;
  };
  let response = forward();

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = forward();
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  // Validates the access token and refreshes it if it has expired.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|samples/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
