// PROTOTYPE: the tournament play screen in each visual direction (see src/lib/prototype-variant.ts).
import Image from "next/image";
import Link from "next/link";
import type { BracketMatch } from "@/domain/tournament/bracket";
import { roundName, THIRD_PLACE_MATCH } from "@/domain/tournament/stage";
import type { Tournament } from "@/server/game";
import { HumanCheck } from "../../human-check";
import { giveUpTournamentAction } from "../actions";
import { PickerArcade, PickerEditorial, PickerGacha, UndoVariant } from "./match-picker-variants";

export type TournamentVariantProps = {
  tournament: Tournament;
  banned: boolean;
  playable: boolean;
  needsHumanCheck: boolean;
};

function statusText(t: Tournament) {
  const left = t.bracket.matchesLeft;
  if (t.status === "given_up") return "Given up";
  if (t.status === "removed") return "Removed";
  if (t.bracket.finished) return "Finished";
  return `${left} ${left === 1 ? "match" : "matches"} left`;
}

function stageText(t: Tournament) {
  const next = t.bracket.next!;
  return next.thirdPlace ? THIRD_PLACE_MATCH : roundName(next.round, t.bracket.rounds.length);
}

function isNext(t: Tournament, match: BracketMatch) {
  const next = t.status === "in_progress" ? t.bracket.next : null;
  return !!next && !match.winnerId && match.contestantIds[0] === next.contestantIds[0] && match.contestantIds[1] === next.contestantIds[1];
}

/** Every round of the bracket, plus the third-place match after the final round's matches. */
function bracketRounds(t: Tournament) {
  const { rounds, thirdPlace } = t.bracket;
  return rounds.map((matches, r) => ({
    name: roundName(r + 1, rounds.length),
    matches,
    extra: r === rounds.length - 1 && thirdPlace ? thirdPlace : null,
  }));
}

function EndedNotice({ t, className, linkClass }: { t: Tournament; className: string; linkClass: string }) {
  if (t.status !== "given_up" && t.status !== "removed") return null;
  return (
    <p className={className}>
      {t.status === "given_up"
        ? "You gave up this tournament. Its played matches still count; it has no tournament ranking."
        : "This tournament ended because one of its contestants or its category was deleted. Its other matches still count; it has no tournament ranking."}{" "}
      <Link href="/tournaments/new" className={linkClass}>
        Play another tournament
      </Link>
    </p>
  );
}

function GiveUp({ tournamentId, summaryClass, buttonClass }: { tournamentId: string; summaryClass: string; buttonClass: string }) {
  return (
    <details className="self-center text-center text-sm">
      <summary className={`cursor-pointer select-none ${summaryClass}`}>Give up</summary>
      <form action={giveUpTournamentAction.bind(null, tournamentId)} className="mt-2 flex flex-col items-center gap-2">
        <p className="max-w-sm opacity-80">
          Matches you&apos;ve played still count, the tournament gets no ranking, and its reserved allowance isn&apos;t
          returned. You can then start another rated tournament.
        </p>
        <button type="submit" className={buttonClass}>
          Give up this tournament
        </button>
      </form>
    </details>
  );
}

/* ------------------------------------------------------------------ A: Arcade versus */

export function VariantArcade({ tournament: t, banned, playable, needsHumanCheck }: TournamentVariantProps) {
  const next = t.bracket.next;
  return (
    <main className="flex w-full flex-1 flex-col gap-5 pb-28">
      <header className="flex items-stretch justify-between gap-2 bg-gradient-to-r from-[#ff2e88] to-[#ff8a00] p-1.5">
        <div className="flex min-w-0 flex-col justify-center gap-0.5 -skew-x-6 bg-[#0b0712] px-3 py-1.5">
          <Link href="/tournaments/new" className="skew-x-6 text-[13px] font-semibold text-zinc-300 hover:text-white">
            ← Tournaments
          </Link>
          <h1 className="skew-x-6 truncate font-arcade text-2xl leading-none text-white uppercase italic">{t.scopeName}</h1>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-center gap-0.5 -skew-x-6 bg-[#0b0712] px-3 py-1.5 text-right">
          <span className="skew-x-6 text-xs font-semibold tracking-wider text-zinc-300 uppercase">{t.rated ? "Ranked bout" : "Free play"}</span>
          <span aria-live="polite" className="skew-x-6 font-arcade text-xl leading-none text-[#ff8a00] uppercase tabular-nums">
            {statusText(t)}
          </span>
        </div>
      </header>

      {banned && t.status === "in_progress" && <p className="mx-4 border-2 border-red-500 p-3">Your account is banned, so you can&apos;t play.</p>}
      {playable && next && needsHumanCheck && (
        <div className="mx-4">
          <HumanCheck />
        </div>
      )}
      {playable && next && !needsHumanCheck && (
        <section aria-label="Current match" className="flex flex-col gap-3">
          <h2 className="text-center font-arcade text-4xl text-[#ff8a00] uppercase italic drop-shadow-[0_0_12px_#ff8a00]">
            {stageText(t)}
          </h2>
          <PickerArcade
            tournamentId={t.id}
            matchIndex={next.index}
            contestants={next.contestantIds.map((id) => t.contestants[id])}
          />
        </section>
      )}

      <div className="flex flex-col items-center gap-3 px-4">
        {!banned && t.canUndo && <UndoVariant tournamentId={t.id} variant="A" />}
        {playable && t.rated && (
          <GiveUp tournamentId={t.id} summaryClass="text-sm font-semibold tracking-wider text-zinc-300 uppercase hover:text-white" buttonClass="border-2 border-red-500 px-4 py-2 font-arcade text-lg uppercase text-red-300" />
        )}
      </div>
      <EndedNotice t={t} className="mx-4 border-2 border-white/30 p-4" linkClass="font-bold text-[#ff8a00] underline" />

      {t.status !== "removed" && t.bracket.ranking && (
        <section aria-labelledby="ranking-heading" className="mx-4 flex flex-col gap-2">
          <h2 id="ranking-heading" className="font-arcade text-4xl uppercase italic">
            Results
          </h2>
          <ol aria-label="Tournament ranking" className="flex flex-col gap-1">
            {t.bracket.ranking.map((tier, i) => (
              <li key={tier.place} className={`flex items-center gap-3 -skew-x-6 px-3 py-2 ${i === 0 ? "bg-[#ff2e88] text-black" : "bg-white/5"}`}>
                <span className="w-16 skew-x-6 font-arcade text-xl uppercase">{tier.place}</span>
                <span className="flex skew-x-6 flex-wrap gap-3">
                  {tier.contestantIds.map((cid) => (
                    <span key={cid} className="flex items-center gap-2 font-semibold">
                      <Image src={t.contestants[cid].picture128Url} alt="" width={128} height={128} className="size-8 object-cover" />
                      {t.contestants[cid].name}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
          <Link href="/tournaments/new" className="mt-2 self-start -skew-x-12 bg-[#ff2e88] px-5 py-3 font-arcade text-xl text-black uppercase shadow-[4px_4px_0_#ff8a00]">
            <span className="inline-block skew-x-12">▶ New tournament</span>
          </Link>
        </section>
      )}

      <section aria-labelledby="bracket-heading" className="flex flex-col gap-2">
        <h2 id="bracket-heading" className="px-4 text-sm font-semibold tracking-[0.25em] text-zinc-300 uppercase">
          Bracket
        </h2>
        <div className="overflow-x-auto px-4 pb-2">
          <div className="flex w-max gap-3">
            {bracketRounds(t).map((round) => (
              <div key={round.name} className="flex w-40 flex-col gap-2">
                <h3 className="text-[13px] font-semibold tracking-wider text-[#ff8a00] uppercase">{round.name}</h3>
                <div className="flex flex-1 flex-col justify-around gap-2">
                  {[...round.matches, ...(round.extra ? [round.extra] : [])].map((match, m) => (
                    <div
                      key={m}
                      className={`-skew-x-6 border-l-4 bg-white/5 ${isNext(t, match) ? "border-[#ff2e88] shadow-[0_0_16px_-2px_#ff2e88]" : "border-white/20"}`}
                    >
                      {match === round.extra && <div className="px-2 pt-1 text-xs text-zinc-300 uppercase">3rd place</div>}
                      {match.contestantIds.map((id, i) => {
                        const c = id ? t.contestants[id] : null;
                        const lost = !!match.winnerId && match.winnerId !== id;
                        const won = !!match.winnerId && match.winnerId === id && !match.bye;
                        return (
                          <div key={i} className={`flex h-8 skew-x-6 items-center gap-2 px-2 text-sm ${lost ? "text-zinc-400 line-through" : ""} ${won ? "font-bold text-[#ff8a00]" : ""}`}>
                            {c ? (
                              <>
                                <Image src={c.picture128Url} alt="" width={128} height={128} className={`size-5 object-cover ${lost ? "opacity-30" : ""}`} />
                                <span className="truncate">{c.name}</span>
                              </>
                            ) : (
                              <span className="text-zinc-400">{match.bye ? "Bye" : "—"}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ B: Gacha card */

export function VariantGacha({ tournament: t, banned, playable, needsHumanCheck }: TournamentVariantProps) {
  const next = t.bracket.next;
  const total = t.bracket.rounds.reduce((n, r) => n + r.filter((m) => !m.bye).length, 0) + (t.bracket.thirdPlace ? 1 : 0);
  const done = Math.max(0, total - t.bracket.matchesLeft);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pt-4 pb-28">
      <header className="flex flex-col gap-2 rounded-3xl bg-white/6 p-4 ring-1 ring-white/10">
        <div className="flex items-center justify-between gap-2">
          <Link href="/tournaments/new" className="rounded-full bg-white/10 px-3 py-1 text-xs text-[#f3dcff]">
            ← Back
          </Link>
          <span className="rounded-full bg-[#c3a6ff]/20 px-3 py-1 text-xs font-medium text-[#e4d8ff] ring-1 ring-[#c3a6ff]/40">
            {t.rated ? "✦ Rated" : "Unrated"}
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-white">{t.scopeName}</h1>
        <div className="flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#ff9ec7] via-[#ffc79e] to-[#c3a6ff] shadow-[0_0_12px_#ff9ec7]"
              style={{ width: `${total ? (done / total) * 100 : 100}%` }}
            />
          </div>
          <span aria-live="polite" className="text-sm whitespace-nowrap text-[#e4d8ff]">
            {statusText(t)}
          </span>
        </div>
      </header>

      {banned && t.status === "in_progress" && <p className="rounded-2xl bg-red-500/20 p-4">Your account is banned, so you can&apos;t play.</p>}
      {playable && next && needsHumanCheck && <HumanCheck />}
      {playable && next && !needsHumanCheck && (
        <section aria-label="Current match" className="flex flex-col gap-3">
          <h2 className="text-center text-sm font-medium tracking-wide text-[#ffc79e]">
            ✧ {stageText(t)} ✧ who do you choose?
          </h2>
          <PickerGacha tournamentId={t.id} matchIndex={next.index} contestants={next.contestantIds.map((id) => t.contestants[id])} />
        </section>
      )}

      <div className="flex flex-col items-center gap-3">
        {!banned && t.canUndo && <UndoVariant tournamentId={t.id} variant="B" />}
        {playable && t.rated && (
          <GiveUp tournamentId={t.id} summaryClass="text-[#c9b3e6]" buttonClass="rounded-full bg-red-400/20 px-5 py-2 font-medium text-red-200 ring-1 ring-red-300/50" />
        )}
      </div>
      <EndedNotice t={t} className="rounded-2xl bg-white/6 p-4 ring-1 ring-white/10" linkClass="font-semibold text-[#ffb8d6] underline" />

      {t.status !== "removed" && t.bracket.ranking && (
        <section aria-labelledby="ranking-heading" className="flex flex-col gap-3">
          <h2 id="ranking-heading" className="text-xl font-semibold text-white">
            Your collection ✦
          </h2>
          <ol aria-label="Tournament ranking" className="flex flex-col gap-2">
            {t.bracket.ranking.map((tier) => (
              <li key={tier.place} className="flex items-center gap-3 rounded-2xl bg-white/6 p-3 ring-1 ring-white/10">
                <span className="w-16 shrink-0 text-sm font-semibold text-[#ffc79e]">{tier.place}</span>
                <span className="flex flex-wrap gap-2">
                  {tier.contestantIds.map((cid) => (
                    <span key={cid} className="flex items-center gap-2 rounded-full bg-white/8 py-1 pr-3 pl-1">
                      <Image src={t.contestants[cid].picture128Url} alt="" width={128} height={128} className="size-7 rounded-full object-cover" />
                      {t.contestants[cid].name}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
          <Link href="/tournaments/new" className="self-start rounded-full bg-gradient-to-r from-[#ff9ec7] to-[#c3a6ff] px-5 py-3 font-semibold text-[#2a1440]">
            Pull another ✦
          </Link>
        </section>
      )}

      <section aria-labelledby="bracket-heading" className="flex flex-col gap-3">
        <h2 id="bracket-heading" className="text-sm font-medium text-[#c9b3e6]">
          Bracket
        </h2>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {bracketRounds(t).map((round) => (
            <div key={round.name} className="flex w-56 shrink-0 snap-start flex-col gap-2 rounded-3xl bg-white/5 p-3 ring-1 ring-white/10">
              <h3 className="text-center text-xs font-semibold text-[#ffb8d6]">{round.name}</h3>
              {[...round.matches, ...(round.extra ? [round.extra] : [])].map((match, m) => (
                <div
                  key={m}
                  className={`flex items-center justify-center gap-1 rounded-2xl p-1.5 ${isNext(t, match) ? "bg-[#ff9ec7]/20 ring-2 ring-[#ff9ec7] shadow-[0_0_14px_-2px_#ff9ec7]" : "bg-white/5"}`}
                >
                  {match.contestantIds.map((id, i) => {
                    const c = id ? t.contestants[id] : null;
                    const lost = !!match.winnerId && match.winnerId !== id;
                    return (
                      <span key={i} className="flex items-center gap-1">
                        {i === 1 && <span className="px-0.5 text-[10px] text-[#c9b3e6]">vs</span>}
                        {c ? (
                          <Image
                            src={c.picture128Url}
                            alt={c.name}
                            title={c.name}
                            width={128}
                            height={128}
                            className={`size-9 rounded-xl object-cover ${lost ? "opacity-30 grayscale" : match.winnerId ? "ring-2 ring-[#ffc79e]" : ""}`}
                          />
                        ) : (
                          <span className="grid size-9 place-items-center rounded-xl bg-white/5 text-[10px] text-[#c9b3e6]">{match.bye ? "bye" : "?"}</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ C: Editorial */

export function VariantEditorial({ tournament: t, banned, playable, needsHumanCheck }: TournamentVariantProps) {
  const next = t.bracket.next;
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 pt-6 pb-28 md:px-10">
      <header className="flex flex-col gap-2 border-b border-[#efe8dc]/70 pb-4">
        <Link href="/tournaments/new" className="text-[11px] tracking-[0.25em] text-[#a39a8c] uppercase hover:text-[#efe8dc]">
          ← Tournaments
        </Link>
        <h1 className="font-serif text-4xl leading-none font-light md:text-6xl">{t.scopeName}</h1>
        <p className="flex gap-3 text-sm text-[#cfc6b8]">
          <span>{t.rated ? "Rated" : "Unrated"}</span>
          <span aria-hidden>·</span>
          <span aria-live="polite">{statusText(t)}</span>
        </p>
      </header>

      {banned && t.status === "in_progress" && <p className="font-serif italic">Your account is banned, so you can&apos;t play.</p>}
      {playable && next && needsHumanCheck && <HumanCheck />}
      {playable && next && !needsHumanCheck && (
        <section aria-label="Current match" className="flex flex-col gap-3">
          <h2 className="text-center font-serif text-lg italic text-[#e8c9a0]">{stageText(t)}</h2>
          <PickerEditorial tournamentId={t.id} matchIndex={next.index} contestants={next.contestantIds.map((id) => t.contestants[id])} />
        </section>
      )}

      <div className="flex items-baseline justify-center gap-6">
        {!banned && t.canUndo && <UndoVariant tournamentId={t.id} variant="C" />}
        {playable && t.rated && (
          <GiveUp tournamentId={t.id} summaryClass="text-[#a39a8c] underline underline-offset-4" buttonClass="border border-red-300/60 px-4 py-2 text-red-200" />
        )}
      </div>
      <EndedNotice t={t} className="border-y border-[#efe8dc]/40 py-3 font-serif text-lg" linkClass="italic underline" />

      {t.status !== "removed" && t.bracket.ranking && (
        <section aria-labelledby="ranking-heading" className="flex flex-col">
          <h2 id="ranking-heading" className="border-b border-[#efe8dc]/70 pb-2 font-serif text-3xl">
            The result
          </h2>
          <ol aria-label="Tournament ranking">
            {t.bracket.ranking.map((tier) => (
              <li key={tier.place} className="grid grid-cols-[4.5rem_1fr] gap-3 border-b border-[#efe8dc]/15 py-3">
                <span className="font-serif text-xl italic text-[#e8c9a0]">{tier.place}</span>
                <span className="font-serif text-xl">{tier.contestantIds.map((cid) => t.contestants[cid].name).join(", ")}</span>
              </li>
            ))}
          </ol>
          <Link href="/tournaments/new" className="mt-4 self-start text-sm tracking-wide underline underline-offset-4">
            Play another tournament →
          </Link>
        </section>
      )}

      <section aria-labelledby="bracket-heading" className="flex flex-col gap-1">
        <h2 id="bracket-heading" className="text-[11px] tracking-[0.25em] text-[#a39a8c] uppercase">
          The bracket
        </h2>
        <div className="grid gap-x-10 md:grid-cols-2">
          {bracketRounds(t).map((round) => (
            <div key={round.name} className="border-t border-[#efe8dc]/70 pt-2 pb-4">
              <h3 className="font-serif text-xl italic">{round.name}</h3>
              <ul className="mt-1">
                {[...round.matches, ...(round.extra ? [round.extra] : [])].map((match, m) => (
                  <li
                    key={m}
                    className={`flex items-baseline gap-2 border-b border-[#efe8dc]/10 py-1.5 text-sm ${isNext(t, match) ? "text-[#e8c9a0]" : ""}`}
                  >
                    {match === round.extra && <span className="text-[10px] tracking-widest text-[#a39a8c] uppercase">3rd</span>}
                    {match.contestantIds.map((id, i) => {
                      const c = id ? t.contestants[id] : null;
                      const lost = !!match.winnerId && match.winnerId !== id;
                      return (
                        <span key={i} className="contents">
                          {i === 1 && <span className="font-serif text-[#a39a8c] italic">v.</span>}
                          <span className={`truncate ${lost ? "text-[#a39a8c] line-through decoration-1" : match.winnerId && !match.bye ? "font-semibold" : ""}`}>
                            {c ? c.name : match.bye ? "bye" : "—"}
                          </span>
                        </span>
                      );
                    })}
                    {isNext(t, match) && <span className="ml-auto text-[10px] tracking-widest uppercase">Now</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
