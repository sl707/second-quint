import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPerson } from "@/lib/session";
import { GameError, getInfinitePair, type InfinitePair } from "@/server/game";
import { startInfiniteModeAction } from "../actions";
import { InfinitePlay } from "./infinite-play";

export const metadata: Metadata = { title: "Infinite Mode" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InfiniteModePage({ params }: PageProps<"/infinite/[scope]">) {
  const { scope } = await params;
  if (scope !== "all" && !UUID.test(scope)) notFound();
  const person = await readPerson();

  let pair: InfinitePair | null = null;
  let problem: string | null = null;
  if (person) {
    try {
      pair = await getInfinitePair(createAdminClient(), person, scope === "all" ? null : scope);
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      problem = error.message;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-5 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <Link href="/infinite" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Infinite Mode
          </Link>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{pair?.scopeName ?? "Infinite Mode"}</h1>
        </div>
        {pair && (
          <p className="text-sm text-zinc-600">
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-700">
              Unrated
            </span>{" "}
            Skip as often as you like
          </p>
        )}
      </header>

      {pair && <InfinitePlay pair={pair} />}

      {problem && (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-zinc-700">
          {problem}{" "}
          <Link href="/infinite" className="font-medium underline">
            Choose another scope
          </Link>
        </p>
      )}

      {!person && (
        <form action={startInfiniteModeAction.bind(null, scope)} className="flex flex-col items-start gap-3">
          <p className="text-zinc-700">Pick the winner of one pair after another, for as long as you like.</p>
          <button type="submit" className="rounded-xl bg-zinc-900 px-5 py-3 font-medium text-white hover:bg-zinc-700">
            Start Infinite Mode
          </button>
        </form>
      )}
    </main>
  );
}
