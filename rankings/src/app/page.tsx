import Link from "next/link";
import { createVisitorClient } from "@/lib/supabase/server";
import { getAppName } from "@/server/app-info";

export default async function Home() {
  const appName = await getAppName(await createVisitorClient());

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{appName}</h1>
      <p className="text-zinc-600">Pick winners in 1v1 matches and see how everyone&apos;s picks add up.</p>
      <Link
        href="/tournaments/new"
        className="self-start rounded-xl bg-zinc-900 px-5 py-3 text-lg font-medium text-white hover:bg-zinc-700"
      >
        Play a tournament
      </Link>
    </main>
  );
}
