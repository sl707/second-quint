import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPerson } from "@/lib/session";
import { RATED_SKIPS_PER_DAY } from "@/domain/allowance/allowance";
import { GameError, getInfinitePair, isSignedIn, type InfinitePair } from "@/server/game";
import { isVisitorVerified } from "@/server/human-check";
import { AllowanceCountdown } from "../../allowance-countdown";
import { HumanCheck } from "../../human-check";
import { Button, inlineLinkClass } from "../../ui/button";
import { RatedChip } from "../../ui/chip";
import { Notice } from "../../ui/plate";
import { startInfiniteModeAction } from "../actions";
import { InfinitePlay } from "./infinite-play";

export const metadata: Metadata = { title: "Infinite Mode" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InfiniteModePage({ params, searchParams }: PageProps<"/infinite/[scope]">) {
  const { scope } = await params;
  if (scope !== "all" && !UUID.test(scope)) notFound();
  const unrated = (await searchParams).play === "unrated";
  const person = await readPerson();
  const now = new Date();

  let pair: InfinitePair | null = null;
  let problem: string | null = null;
  if (person) {
    try {
      pair = await getInfinitePair(createAdminClient(), person, scope === "all" ? null : scope, { unrated, now });
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      problem = error.message;
    }
  }

  const needsHumanCheck = !!person && !isSignedIn(person) && !(await isVisitorVerified(createAdminClient(), person));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 pb-16">
      <header className="bg-gradient-to-r from-pink to-orange p-1.5">
        <div className="flex -skew-x-3 flex-col gap-1 bg-ink px-3 py-2">
          <div className="flex skew-x-3 flex-wrap items-end justify-between gap-x-3 gap-y-1">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Link href="/infinite" className="text-[13px] font-semibold text-zinc-200 hover:text-white">
                ← Infinite Mode
              </Link>
              <h1 className="truncate pr-[0.15em] font-display text-2xl leading-none uppercase italic md:text-3xl">
                {pair?.scopeName ?? "Infinite Mode"}
              </h1>
            </div>
            {pair?.allowanceResetsAt && (
              <p className="text-[13px] text-zinc-200">
                Rated allowance resets at midnight Eastern, in{" "}
                <span className="font-semibold text-orange-bright tabular-nums">
                  <AllowanceCountdown resetsAt={pair.allowanceResetsAt} renderedAt={now.toISOString()} />
                </span>
                .
              </p>
            )}
          </div>
          {pair && (
            <div className="skew-x-3">
              <PlayStatus play={pair.play} scope={scope} />
            </div>
          )}
        </div>
      </header>

      {pair && needsHumanCheck && (
        <div className="px-4">
          <HumanCheck />
        </div>
      )}
      {pair && !needsHumanCheck && <InfinitePlay pair={pair} />}

      {problem && (
        <div className="px-4">
          <Notice tone="warn">
            {problem}{" "}
            <Link href="/infinite" className={inlineLinkClass}>
              Choose another scope
            </Link>
          </Notice>
        </div>
      )}

      {!person && (
        <form action={startInfiniteModeAction} className="flex flex-col items-start gap-4 px-4">
          <input type="hidden" name="scope" value={scope} />
          <p className="text-zinc-100">Pick the winner of one pair after another, for as long as you like.</p>
          <Button size="lg">
            <span aria-hidden>▶ </span>Start Infinite Mode
          </Button>
        </form>
      )}
    </main>
  );
}

/** Whether picks count as rated right now, and what's left today or why they don't. */
function PlayStatus({ play, scope }: { play: InfinitePair["play"]; scope: string }) {
  if (play.rated) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-zinc-100">
        <RatedChip rated /> {play.ratedPicksLeft} rated {play.ratedPicksLeft === 1 ? "pick" : "picks"} left today ·{" "}
        {play.ratedSkipsLeft} of {RATED_SKIPS_PER_DAY} rated skips left
      </p>
    );
  }
  return (
    <p className="text-[13px] text-zinc-100">
      <RatedChip rated={false} />{" "}
      {play.reason === "allowance-used-up"
        ? "Your rated allowance here is used up for today, so picks are unrated until midnight Eastern. Skip as often as you like."
        : "Skip as often as you like."}
      {play.reason === "chose-unrated" && (
        <>
          {" "}
          <Link href={`/infinite/${scope}`} className={inlineLinkClass}>
            Play rated
          </Link>
        </>
      )}
    </p>
  );
}
