import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PATHNAME_HEADER } from "@/lib/pathname";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/server/admin";
import { signInWithGoogleAction, signOutAction } from "./auth/actions";

const buttonClass = "rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-zinc-100";

/** Sign in / sign out, and the first-sign-in detour to choose a display name. */
export async function SiteHeader() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/";
  const session = await getSession();
  if (session.status === "needs-display-name" && pathname !== "/welcome") {
    redirect(`/welcome?next=${encodeURIComponent(pathname)}`);
  }

  const admin = session.status === "player" && (await isAdmin(createAdminClient(), { playerId: session.player.id }));

  return (
    <nav aria-label="Account" className="flex items-center justify-end gap-1 border-b border-zinc-200 bg-white px-4 py-2">
      {session.status === "player" ? (
        <>
          {admin && (
            <Link href="/admin" className={buttonClass}>
              Admin
            </Link>
          )}
          <Link
            href={`/players/${encodeURIComponent(session.player.displayName)}`}
            className={buttonClass}
          >
            {session.player.displayName}
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={`${buttonClass} text-zinc-600`}>
              Sign out
            </button>
          </form>
        </>
      ) : session.status === "needs-display-name" ? (
        <form action={signOutAction}>
          <button type="submit" className={`${buttonClass} text-zinc-600`}>
            Sign out
          </button>
        </form>
      ) : (
        <form action={signInWithGoogleAction}>
          <input type="hidden" name="next" value={pathname} />
          <button type="submit" className={buttonClass}>
            Sign in with Google
          </button>
        </form>
      )}
    </nav>
  );
}
