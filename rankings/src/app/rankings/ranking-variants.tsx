// PROTOTYPE: the Overall/Category ranking page in each visual direction (see src/lib/prototype-variant.ts).
import Image from "next/image";
import Link from "next/link";
import type { GlobalRanking } from "@/server/rankings";

export type RankingVariantProps = {
  ranking: GlobalRanking;
  kind: "Overall Ranking" | "Category Ranking";
  path: string;
};

function updatedAt(ranking: GlobalRanking) {
  return new Date(ranking.refreshedAt!).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
}

function emptyText(ranking: GlobalRanking) {
  return ranking.rated ? "No rated matches have been played here yet." : "No matches have been played here yet.";
}

function Switch({ ranking, path, base, on, off }: { ranking: GlobalRanking; path: string; base: string; on: string; off: string }) {
  return (
    <nav aria-label="Ranking version" className={base}>
      <Link href={path} aria-current={ranking.rated ? "page" : undefined} className={ranking.rated ? on : off}>
        Rated
      </Link>
      <Link href={`${path}?version=unrated`} aria-current={ranking.rated ? undefined : "page"} className={ranking.rated ? off : on}>
        Unrated
      </Link>
    </nav>
  );
}

/* ------------------------------------------------------------------ A: Arcade leaderboard */

export function VariantArcade({ ranking, kind, path }: RankingVariantProps) {
  const numeral = ["text-[#ff2e88] drop-shadow-[0_0_10px_#ff2e88]", "text-[#ff8a00] drop-shadow-[0_0_10px_#ff8a00]", "text-[#ffd23f]"];
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pt-6 pb-28">
      <header className="flex flex-col gap-1">
        <Link href="/rankings" className="font-arcade text-xs tracking-[0.3em] text-white/60 uppercase hover:text-[#ff8a00]">
          ← Leaderboards
        </Link>
        <h1 className="font-arcade text-5xl leading-none uppercase italic">
          <span className="animate-neon">{ranking.scopeName}</span>
        </h1>
        <p className="text-xs tracking-widest text-white/60 uppercase">
          {kind === "Category Ranking" ? "Category · " : "High scores · "}
          {ranking.rated ? "Rated picks only" : "Every pick"} · recent matches count more
        </p>
      </header>

      <Switch
        ranking={ranking}
        path={path}
        base="grid grid-cols-2 gap-2"
        on="-skew-x-12 bg-[#ff2e88] py-2 text-center font-arcade text-lg uppercase tracking-widest text-black"
        off="-skew-x-12 border-2 border-white/25 py-2 text-center font-arcade text-lg uppercase tracking-widest text-white/70 hover:border-[#ff2e88]"
      />

      {ranking.refreshedAt === null ? (
        <p className="border-2 border-white/25 p-4 font-arcade uppercase">Insert coin: not calculated yet. Refreshes every 5 minutes.</p>
      ) : ranking.ranked.length === 0 ? (
        <p className="text-white/70">{emptyText(ranking)}</p>
      ) : (
        <ol aria-label={ranking.scopeName} className="flex flex-col">
          <li aria-hidden className="grid grid-cols-[3.5rem_1fr_auto] gap-3 border-b-2 border-[#ff2e88] pb-1 font-arcade text-xs tracking-[0.3em] text-white/60 uppercase">
            <span>Rank</span>
            <span>Name</span>
            <span>Score</span>
          </li>
          {ranking.ranked.map((row, i) => (
            <li
              key={row.contestant.id}
              className={`grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 border-b border-white/10 py-2 ${i < 3 ? "bg-gradient-to-r from-white/8 to-transparent" : ""}`}
            >
              <span className={`text-center font-arcade leading-none italic tabular-nums ${i < 3 ? `text-5xl ${numeral[i]}` : "text-3xl text-white/45"}`}>
                {row.position}
              </span>
              <span className="flex min-w-0 items-center gap-3">
                <Image
                  src={row.contestant.picture128Url}
                  alt=""
                  width={128}
                  height={128}
                  className={`shrink-0 -skew-x-6 object-cover ${i < 3 ? "size-14 border-2 border-white" : "size-11"}`}
                />
                <span className="truncate font-arcade text-xl uppercase">{row.contestant.name}</span>
              </span>
              <span className="text-right">
                <span className="block font-arcade text-2xl leading-none text-[#ff8a00] tabular-nums">{Math.round(row.score)}</span>
                <span className="block font-mono text-[11px] text-white/60">
                  {row.wins}W {row.losses}L
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {ranking.notYetJudged.length > 0 && (
        <section aria-labelledby="not-yet-judged" className="flex flex-col gap-2">
          <h2 id="not-yet-judged" className="font-arcade text-xl uppercase italic text-white/80">
            New challengers <span className="text-sm text-white/50 not-italic">(not yet judged)</span>
          </h2>
          <ul aria-labelledby="not-yet-judged" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {ranking.notYetJudged.map((c) => (
              <li key={c.id} className="flex flex-col gap-1">
                <Image src={c.picture128Url} alt="" width={128} height={128} className="aspect-square w-full -skew-x-6 object-cover opacity-70" />
                <span className="truncate text-center text-[11px] text-white/70 uppercase">{c.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ranking.refreshedAt && <p className="font-mono text-[11px] text-white/50">Updated {updatedAt(ranking)} ET · refreshes every 5 min</p>}
    </main>
  );
}

/* ------------------------------------------------------------------ B: Gacha podium + card grid */

export function VariantGacha({ ranking, kind, path }: RankingVariantProps) {
  const [first, second, third] = ranking.ranked;
  const rest = ranking.ranked.slice(3);
  const podium = [
    { row: second, h: "h-16", medal: "🥈", glow: "#c3a6ff" },
    { row: first, h: "h-24", medal: "👑", glow: "#ff9ec7" },
    { row: third, h: "h-10", medal: "🥉", glow: "#ffc79e" },
  ];
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pt-5 pb-28">
      <header className="flex flex-col items-center gap-1 text-center">
        <Link href="/rankings" className="rounded-full bg-white/10 px-3 py-1 text-xs text-[#f3dcff]">
          ← Rankings
        </Link>
        <h1 className="bg-gradient-to-r from-[#ffb8d6] via-[#ffd2b0] to-[#d4bfff] bg-clip-text text-3xl font-semibold text-transparent">
          {ranking.scopeName}
        </h1>
        <p className="text-sm text-[#d9c6ee]">
          {kind === "Category Ranking" ? "Category Ranking · " : ""}
          {ranking.rated ? "Rated picks only" : "Every pick"}, recent matches count more
        </p>
      </header>

      <Switch
        ranking={ranking}
        path={path}
        base="mx-auto flex gap-1 rounded-full bg-white/8 p-1 ring-1 ring-white/10"
        on="rounded-full bg-gradient-to-r from-[#ff9ec7] to-[#c3a6ff] px-5 py-1.5 text-sm font-semibold text-[#2a1440]"
        off="rounded-full px-5 py-1.5 text-sm text-[#e4d8ff]"
      />

      {ranking.refreshedAt === null ? (
        <p className="rounded-3xl bg-white/6 p-4 text-center">This ranking hasn&apos;t been calculated yet. Rankings refresh every 5 minutes.</p>
      ) : ranking.ranked.length === 0 ? (
        <p className="text-center text-[#d9c6ee]">{emptyText(ranking)}</p>
      ) : (
        <ol aria-label={ranking.scopeName} className="flex flex-col gap-5">
          <li className="grid grid-cols-3 items-end gap-2">
            {podium.map(({ row, h, medal, glow }, i) =>
              row ? (
                <div key={row.contestant.id} className="flex flex-col items-center gap-1 text-center">
                  <span className="text-2xl">{medal}</span>
                  <div className={`w-full rounded-2xl holo-frame animate-holo p-0.5 ${i === 1 ? "animate-float" : ""}`} style={{ boxShadow: `0 0 28px -6px ${glow}` }}>
                    <div className="relative aspect-square overflow-hidden rounded-[0.9rem]">
                      <Image src={row.contestant.picture512Url} alt="" fill sizes="33vw" className="object-cover" />
                      <span aria-hidden className="holo-sheen absolute inset-0 animate-holo mix-blend-screen" />
                    </div>
                  </div>
                  <span className="line-clamp-2 text-sm leading-tight font-semibold">{row.contestant.name}</span>
                  <span className="text-xs text-[#d9c6ee]">
                    {Math.round(row.score)} · {row.wins}–{row.losses}
                  </span>
                  <div className={`${h} grid w-full place-items-center rounded-t-2xl bg-gradient-to-b from-white/15 to-white/5 text-2xl font-bold`} style={{ color: glow }}>
                    {row.position}
                  </div>
                </div>
              ) : (
                <div key={i} />
              ),
            )}
          </li>
          {rest.length > 0 && (
            <li>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {rest.map((row) => (
                  <li key={row.contestant.id} className="flex flex-col overflow-hidden rounded-2xl bg-white/6 ring-1 ring-white/10 transition active:scale-95">
                    <div className="relative aspect-square">
                      <Image src={row.contestant.picture512Url} alt="" fill sizes="50vw" className="object-cover" />
                      <span className="absolute top-2 left-2 grid size-8 place-items-center rounded-full bg-[#150f2b]/80 text-sm font-semibold text-[#ffc79e] ring-1 ring-[#ffc79e]/50">
                        {row.position}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="truncate text-sm font-semibold">{row.contestant.name}</span>
                      <span className="shrink-0 text-right text-xs leading-tight text-[#d9c6ee]">
                        <span className="block text-sm font-semibold text-white">{Math.round(row.score)}</span>
                        {row.wins}–{row.losses}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ol>
      )}

      {ranking.notYetJudged.length > 0 && (
        <section aria-labelledby="not-yet-judged" className="flex flex-col gap-2">
          <h2 id="not-yet-judged" className="text-sm font-medium text-[#c9b3e6]">
            ✧ Not yet judged
          </h2>
          <ul aria-labelledby="not-yet-judged" className="flex flex-wrap gap-2">
            {ranking.notYetJudged.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-full bg-white/6 py-1 pr-3 pl-1 text-sm ring-1 ring-white/10">
                <Image src={c.picture128Url} alt="" width={128} height={128} className="size-7 rounded-full object-cover" />
                {c.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {ranking.refreshedAt && <p className="text-center text-xs text-[#c9b3e6]">Updated {updatedAt(ranking)} ET · refreshes every 5 minutes</p>}
    </main>
  );
}

/* ------------------------------------------------------------------ C: Editorial typographic list */

export function VariantEditorial({ ranking, kind, path }: RankingVariantProps) {
  const [lead, ...rest] = ranking.ranked;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-8 pb-28 md:px-10">
      <Link href="/rankings" className="text-[11px] tracking-[0.25em] text-[#a39a8c] uppercase hover:text-[#efe8dc]">
        ← The Rankings
      </Link>
      <h1 className="mt-2 font-serif text-5xl leading-[0.95] font-light md:text-7xl">{ranking.scopeName}</h1>
      <div className="mt-4 flex items-baseline justify-between gap-4 border-y border-[#efe8dc]/70 py-2">
        <p className="text-xs text-[#cfc6b8]">
          {kind}. {ranking.rated ? "Rated picks only" : "Every pick"}; recent matches count more.
        </p>
        <Switch
          ranking={ranking}
          path={path}
          base="flex shrink-0 gap-3 text-sm"
          on="font-serif italic underline underline-offset-4"
          off="text-[#a39a8c] hover:text-[#efe8dc]"
        />
      </div>

      {ranking.refreshedAt === null ? (
        <p className="mt-6 font-serif text-xl italic">This ranking hasn&apos;t been calculated yet. Rankings refresh every five minutes.</p>
      ) : !lead ? (
        <p className="mt-6 font-serif text-xl italic">{emptyText(ranking)}</p>
      ) : (
        <ol aria-label={ranking.scopeName} className="mt-6">
          <li className="grid gap-4 border-b border-[#efe8dc]/70 pb-6 md:grid-cols-2">
            <div className="relative -mx-5 aspect-square md:mx-0">
              <Image src={lead.contestant.picture512Url} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
            <div className="flex flex-col justify-end">
              <span className="font-serif text-[7rem] leading-[0.8] font-light text-[#e8c9a0] italic">{lead.position}</span>
              <span className="mt-2 font-serif text-4xl leading-tight">{lead.contestant.name}</span>
              <span className="mt-2 text-sm text-[#cfc6b8] tabular-nums">
                Score {Math.round(lead.score)} · {lead.wins} wins, {lead.losses} losses
              </span>
            </div>
          </li>
          {rest.map((row) => (
            <li key={row.contestant.id} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 border-b border-[#efe8dc]/15 py-3">
              <span className="font-serif text-5xl leading-none font-light text-[#a39a8c] tabular-nums">{row.position}</span>
              <span className="flex min-w-0 items-center gap-3">
                <Image src={row.contestant.picture128Url} alt="" width={128} height={128} className="size-12 shrink-0 object-cover" />
                <span className="truncate font-serif text-xl">{row.contestant.name}</span>
              </span>
              <span className="text-right text-sm tabular-nums">
                <span className="block">{Math.round(row.score)}</span>
                <span className="block text-xs text-[#a39a8c]">
                  {row.wins}–{row.losses}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {ranking.notYetJudged.length > 0 && (
        <section aria-labelledby="not-yet-judged" className="mt-8">
          <h2 id="not-yet-judged" className="text-[11px] tracking-[0.25em] text-[#a39a8c] uppercase">
            Not yet judged
          </h2>
          <ul aria-labelledby="not-yet-judged" className="mt-2 font-serif text-lg leading-relaxed text-[#cfc6b8]">
            {ranking.notYetJudged.map((c, i) => (
              <li key={c.id} className="inline">
                {c.name}
                {i < ranking.notYetJudged.length - 1 ? ", " : "."}
              </li>
            ))}
          </ul>
        </section>
      )}

      {ranking.refreshedAt && <p className="mt-8 text-xs text-[#a39a8c]">Updated {updatedAt(ranking)} ET. Rankings refresh every five minutes.</p>}
    </main>
  );
}
