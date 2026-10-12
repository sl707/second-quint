import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/pathname";
import { getSession } from "@/lib/session";
import { DisplayNameForm } from "./display-name-form";

export const metadata: Metadata = { title: "Choose a display name" };

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);
  const session = await getSession();
  if (session.status === "signed-out") redirect("/");
  if (session.status === "player") redirect(nextPath);

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
