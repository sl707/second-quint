import Image from "next/image";
import Link from "next/link";
import { readPerson } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createVisitorClient } from "@/lib/supabase/server";
import { getAppName } from "@/server/app-info";
import { listUnfinishedTournaments } from "@/server/game";
import { UnfinishedTournaments } from "./unfinished-tournaments";
import { ButtonLink } from "./ui/button";

const menu = [
  { href: "/infinite", label: "Play Infinite Mode", hint: "One pair after another" },
  { href: "/rankings", label: "See rankings", hint: "Who's on top" },
  { href: "/categories", label: "Browse categories", hint: "Pick a subject" },
];

/** The app name split so its last word gets the gradient. */
function splitName(appName: string) {
  const words = appName.split(" ");
  return words.length > 1 ? [words.slice(0, -1).join(" "), words.at(-1)!] : [appName, ""];
}

export default async function Home() {
  const person = await readPerson();
  const [appName, unfinished] = await Promise.all([
    getAppName(await createVisitorClient()),
    person ? listUnfinishedTournaments(createAdminClient(), person) : [],
  ]);
  const [lead, last] = splitName(appName);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-5 px-5 pt-8 pb-16 text-center">
      <div className="relative">
        <div aria-hidden className="absolute -inset-3 -skew-x-6 bg-gradient-to-r from-pink to-orange opacity-60 blur-xl" />
        <Image
          src="/nino-idol.gif"
          alt=""
          width={256}
          height={256}
          priority
          unoptimized
          className="relative size-48 -skew-x-6 border-4 border-white object-cover shadow-[8px_8px_0_var(--color-orange)] md:size-64"
        />
      </div>
      <h1 className="mt-4 font-display text-6xl leading-[0.9] uppercase italic md:text-8xl">
        <span className="block animate-neon text-white">{lead}</span>
        {last && (
          <>
            {" "}
            <span className="block text-orange-bright">{last}</span>
          </>
        )}
      </h1>
      <p className="max-w-sm text-sm font-medium tracking-wide text-zinc-200 uppercase">
        Pick winners in 1v1 matches and see how everyone&apos;s picks add up.
      </p>

      <UnfinishedTournaments tournaments={unfinished} />

      <ButtonLink href="/tournaments/new" size="lg" className="mt-2 w-full py-5">
        <span aria-hidden>▶ </span>Play a tournament
      </ButtonLink>
      <nav aria-label="Modes" className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
        {menu.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex -skew-x-12 items-center justify-between gap-2 border-2 border-edge bg-plate px-5 py-3 transition hover:border-pink hover:bg-raised sm:flex-col sm:items-start sm:text-left"
          >
            <span className="skew-x-12 font-display text-xl uppercase">{m.label}</span>
            <span className="skew-x-12 text-[13px] font-semibold tracking-widest text-orange-bright uppercase">{m.hint}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
