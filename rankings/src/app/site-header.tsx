import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PATHNAME_HEADER } from "@/lib/pathname";
import type { Variant } from "@/lib/prototype-variant";
import { readVariant } from "@/lib/prototype-variant-server";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/server/admin";
import { signInWithGoogleAction, signOutAction } from "./auth/actions";

// PROTOTYPE: each variant restyles the header; `current` is unchanged.
const looks: Record<Variant, { nav: string; button: string; muted: string; brand: ReactNode }> = {
  current: {
    nav: "flex items-center justify-end gap-1 border-b border-zinc-200 bg-white px-4 py-2",
    button: "rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-zinc-100",
    muted: "text-zinc-600",
    brand: null,
  },
  A: {
    nav: "sticky top-0 z-40 flex items-center gap-1 border-b-2 border-[#ff2e88] bg-black/85 px-3 py-2 backdrop-blur",
    button: "whitespace-nowrap px-2 py-1.5 text-sm font-semibold uppercase tracking-wider text-zinc-200 hover:text-[#ff8a00]",
    muted: "text-zinc-400",
    brand: (
      <Link href="/" className="mr-auto font-arcade text-xl uppercase italic tracking-wide">
        <span className="text-[#ff2e88]">2nd</span>
        <span className="text-[#ff8a00]">Quint</span>
      </Link>
    ),
  },
  B: {
    nav: "mx-3 mt-3 flex items-center gap-1 rounded-full bg-white/8 px-2 py-1.5 shadow-[0_8px_30px_-12px_rgb(255_120_200/0.45)] ring-1 ring-[#ff9ec7]/30 backdrop-blur",
    button: "rounded-full px-3 py-1.5 text-sm font-medium text-[#f3dcff] transition hover:bg-white/10 active:scale-95",
    muted: "text-[#c9b3e6]",
    brand: (
      <Link href="/" className="mr-auto flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#ff9ec7] to-[#c3a6ff] px-3 py-1 text-sm font-semibold text-[#2a1440]">
        ✦ Quint
      </Link>
    ),
  },
  C: {
    nav: "flex items-baseline gap-4 border-b border-[#efe8dc]/70 px-5 pt-5 pb-3 md:px-10",
    button: "text-[13px] tracking-wide text-[#efe8dc] underline-offset-4 hover:underline",
    muted: "text-[#a39a8c]",
    brand: (
      <Link href="/" className="mr-auto font-serif text-2xl italic leading-none tracking-tight">
        Second Quint
      </Link>
    ),
  },
};

/** Sign in / sign out, and the first-sign-in detour to choose a display name. */
export async function SiteHeader() {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/";
  const session = await getSession();
  if (session.status === "needs-display-name" && pathname !== "/welcome") {
    redirect(`/welcome?next=${encodeURIComponent(pathname)}`);
  }

  const admin = session.status === "player" && (await isAdmin(createAdminClient(), { playerId: session.player.id }));
  const look = looks[await readVariant()];
  const buttonClass = look.button;

  return (
    <nav aria-label="Account" className={look.nav}>
      {look.brand}
      <Link href="/players" className={buttonClass}>
        Players
      </Link>
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
            <button type="submit" className={`${buttonClass} ${look.muted}`}>
              Sign out
            </button>
          </form>
        </>
      ) : session.status === "needs-display-name" ? (
        <form action={signOutAction}>
          <button type="submit" className={`${buttonClass} ${look.muted}`}>
            Sign out
          </button>
        </form>
      ) : (
        <form action={signInWithGoogleAction}>
          <input type="hidden" name="next" value={pathname} />
          <button type="submit" className={buttonClass}>
            Sign in<span className={look.brand ? "max-sm:hidden" : ""}> with Google</span>
          </button>
        </form>
      )}
    </nav>
  );
}
