import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PATHNAME_HEADER } from "@/lib/pathname";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/server/admin";
import { signInWithGoogleAction, signOutAction } from "./auth/actions";

const itemClass = "whitespace-nowrap px-1.5 py-1.5 text-[13px] font-semibold tracking-wide text-zinc-100 hover:text-orange-bright sm:px-2 sm:text-sm sm:tracking-wider";
const labelClass = `${itemClass} uppercase`;

/** Sign in / sign out, and the first-sign-in detour to choose a display name. */
export async function SiteHeader() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/";
  const session = await getSession();
  if (session.status === "needs-display-name" && pathname !== "/welcome") {
    redirect(`/welcome?next=${encodeURIComponent(pathname)}`);
  }

  const admin = session.status === "player" && (await isAdmin(createAdminClient(), { playerId: session.player.id }));

  return (
    <nav
      aria-label="Account"
      className="sticky top-0 z-40 flex items-center gap-0.5 border-b-2 border-pink bg-black/95 px-3 py-2 backdrop-blur"
    >
      <Link href="/" className="mr-auto shrink-0 pr-1 font-display text-xl tracking-wide uppercase italic">
        <span className="text-pink-bright">2nd</span>
        <span className="text-orange-bright">Quint</span>
        <span className="sr-only"> Rankings home</span>
      </Link>
      <Link href="/players" className={labelClass}>
        Players
      </Link>
      {session.status === "player" ? (
        <>
          {admin && (
            <Link href="/admin" className={labelClass}>
              Admin
            </Link>
          )}
          <Link
            href={`/players/${encodeURIComponent(session.player.displayName)}`}
            className={`${itemClass} min-w-0 truncate`}
          >
            {session.player.displayName}
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={`${labelClass} text-muted`}>
              Sign out
            </button>
          </form>
        </>
      ) : session.status === "needs-display-name" ? (
        <form action={signOutAction}>
          <button type="submit" className={`${labelClass} text-muted`}>
            Sign out
          </button>
        </form>
      ) : (
        <form action={signInWithGoogleAction}>
          <input type="hidden" name="next" value={pathname} />
          <button type="submit" className={`${labelClass} text-orange-bright`}>
            Sign in<span className="max-sm:sr-only"> with Google</span>
          </button>
        </form>
      )}
    </nav>
  );
}
