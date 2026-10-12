import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/pathname";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { BANNED_IDENTITY_MESSAGE, isBannedIdentity } from "@/server/profiles";
import { Page, PageHeader } from "../ui/frame";
import { Notice } from "../ui/plate";
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
      <Page>
        <PageHeader title={BANNED_IDENTITY_MESSAGE} />
        <Notice tone="danger" role="alert">
          This sign-in belonged to a player who was banned, so it can&apos;t become a player again. Sign out to keep
          browsing and playing without an account.
        </Notice>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader kicker="New player" title="Choose a display name">
        <p>This is how other players will know you.</p>
      </PageHeader>
      <DisplayNameForm next={nextPath} />
    </Page>
  );
}
