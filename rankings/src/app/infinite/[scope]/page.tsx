import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPerson } from "@/lib/session";
import { RATED_SKIPS_PER_DAY } from "@/domain/allowance/allowance";
import { GameError, getInfinitePair, type InfinitePair } from "@/server/game";
import { isVisitorVerified } from "@/server/human-check";
import { HumanCheck } from "../../human-check";
import { startInfiniteModeAction } from "../actions";
import { InfinitePlay } from "./infinite-play";

export const metadata: Metadata = { title: "Infinite Mode" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InfiniteModePage({ params, searchParams }: PageProps<"/infinite/[scope]">) {
  const { scope } = await params;
  if (scope !== "all" && !UUID.test(scope)) notFound();
  const unrated = (await searchParams).play === "unrated";
  const person = await readPerson();

  let pair: InfinitePair | null = null;
  let problem: string | null = null;
  if (person) {
    try {
      pair = await getInfinitePair(createAdminClient(), person, scope === "all" ? null : scope, { unrated });
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      problem = error.message;
    }
  }

  const needsHumanCheck = !!person && "visitorId" in person && !(await isVisitorVerified(createAdminClient(), person));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-5 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <Link href="/infinite" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Infinite Mode
          </Link>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{pair?.scopeName ?? "Infinite Mode"}</h1>
        </div>
        {pair && <PlayStatus play={pair.play} scope={scope} />}
      </header>

      {pair && needsHumanCheck && <HumanCheck />}
      {pair && !needsHumanCheck && <InfinitePlay pair={pair} />}

      {problem && (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-zinc-700">
          {problem}{" "}
          <Link href="/infinite" className="font-medium underline">
            Choose another scope
          </Link>
        </p>
      )}

      {!person && (
        <form action={startInfiniteModeAction} className="flex flex-col items-start gap-3">
          <input type="hidden" name="scope" value={scope} />
          <p className="text-zinc-700">Pick the winner of one pair after another, for as long as you like.</p>
          <button type="submit" className="rounded-xl bg-zinc-900 px-5 py-3 font-medium text-white hover:bg-zinc-700">
            Start Infinite Mode
          </button>
        </form>
      )}
    </main>
  );
}

function Badge({ rated }: { rated: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
        rated ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"
      }`}
    >
      {rated ? "Rated" : "Unrated"}
    </span>
  );
}

/** Whether picks count as rated right now, and what's left today or why they don't. */
function PlayStatus({ play, scope }: { play: InfinitePair["play"]; scope: string }) {
  if (play.rated) {
    return (
      <p className="text-sm text-zinc-600">
        <Badge rated /> {play.ratedPicksLeft} rated {play.ratedPicksLeft === 1 ? "pick" : "picks"} left today ·{" "}
        {play.ratedSkipsLeft} of {RATED_SKIPS_PER_DAY} rated skips left
      </p>
    );
  }
  return (
    <p className="text-sm text-zinc-600">
      <Badge rated={false} />{" "}
      {play.reason === "allowance-used-up"
        ? "Your rated allowance here is used up for today, so picks are unrated until midnight Eastern. Skip as often as you like."
        : "Skip as often as you like."}
      {play.reason === "chose-unrated" && (
        <>
          {" "}
          <Link href={`/infinite/${scope}`} className="font-medium underline">
            Play rated
          </Link>
        </>
      )}
    </p>
  );
}
