import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/pathname";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { BANNED_IDENTITY_MESSAGE, isBannedIdentity } from "@/server/profiles";
import { DisplayNameForm } from "./display-name-form";

export const metadata: Metadata = { title: "Choose a display name" };

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);
  const session = await getSession();
  if (session.status === "signed-out") redirect("/");
  if (session.status === "player") redirect(nextPath);

  if (await isBannedIdentity(createAdminClient(), session.userId)) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-5 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{BANNED_IDENTITY_MESSAGE}</h1>
        <p role="alert" className="text-zinc-600">
          This sign-in belonged to a player who was banned, so it can&apos;t become a player again. Sign out to keep
          browsing and playing without an account.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a display name</h1>
        <p className="text-zinc-600">This is how other players will know you.</p>
      </header>
      <DisplayNameForm next={nextPath} />
    </main>
  );
}
