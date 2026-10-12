import Link from "next/link";
import { readPerson } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createVisitorClient } from "@/lib/supabase/server";
import { getAppName } from "@/server/app-info";
import { listUnfinishedTournaments } from "@/server/game";
import { readVariant } from "@/lib/prototype-variant-server";
import { VariantArcade, VariantEditorial, VariantGacha } from "./home-variants";
import { UnfinishedTournaments } from "./unfinished-tournaments";

export default async function Home() {
  const person = await readPerson();
  const [appName, unfinished] = await Promise.all([
    getAppName(await createVisitorClient()),
    person ? listUnfinishedTournaments(createAdminClient(), person) : [],
  ]);

  const variant = await readVariant();
  if (variant === "A") return <VariantArcade appName={appName} unfinished={unfinished} />;
  if (variant === "B") return <VariantGacha appName={appName} unfinished={unfinished} />;
  if (variant === "C") return <VariantEditorial appName={appName} unfinished={unfinished} />;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{appName}</h1>
      <p className="text-zinc-600">Pick winners in 1v1 matches and see how everyone&apos;s picks add up.</p>
      <UnfinishedTournaments tournaments={unfinished} />
      <Link
        href="/tournaments/new"
        className="self-start rounded-xl bg-zinc-900 px-5 py-3 text-lg font-medium text-white hover:bg-zinc-700"
      >
        Play a tournament
      </Link>
      <Link
        href="/infinite"
        className="self-start rounded-xl border border-zinc-300 bg-white px-5 py-3 text-lg font-medium hover:border-zinc-500"
      >
        Play Infinite Mode
      </Link>
      <Link
        href="/rankings"
        className="self-start rounded-xl border border-zinc-300 bg-white px-5 py-3 text-lg font-medium hover:border-zinc-500"
      >
        See rankings
      </Link>
      <Link
        href="/categories"
        className="self-start rounded-xl border border-zinc-300 bg-white px-5 py-3 text-lg font-medium hover:border-zinc-500"
      >
        Browse categories
      </Link>
    </main>
  );
}
