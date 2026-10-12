// PROTOTYPE: the home page in each visual direction (see src/lib/prototype-variant.ts).
import Link from "next/link";
import type { UnfinishedTournament } from "@/server/game";

type HomeProps = { appName: string; unfinished: UnfinishedTournament[] };

/** A: dark arcade title screen, big condensed type, neon pink/orange, "press start" menu. */
export function VariantArcade({ appName, unfinished }: HomeProps) {
  const menu = [
    { href: "/infinite", label: "Infinite mode", hint: "Endless 1v1" },
    { href: "/rankings", label: "Leaderboards", hint: "Who's on top" },
    { href: "/categories", label: "Select stage", hint: "Categories" },
  ];
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(#ff2e8833_1px,transparent_1px),linear-gradient(90deg,#ff2e8833_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,transparent,black_40%)]"
      />
      <section className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-5 pt-8 pb-28 text-center">
        <div className="relative">
          <div aria-hidden className="absolute -inset-3 -skew-x-6 bg-gradient-to-r from-[#ff2e88] to-[#ff8a00] blur-xl opacity-60" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/prototype/nino-idol.gif"
            alt=""
            className="relative h-48 w-48 -skew-x-6 border-4 border-white object-cover shadow-[8px_8px_0_#ff8a00] md:h-64 md:w-64"
          />
        </div>
        <h1 className="mt-4 font-arcade text-6xl leading-[0.9] uppercase italic md:text-8xl">
          <span className="block animate-neon text-white">{appName.split(" ").slice(0, -1).join(" ") || appName}</span>
          <span className="block bg-gradient-to-r from-[#ff2e88] to-[#ff8a00] bg-clip-text text-transparent">
            {appName.split(" ").length > 1 ? appName.split(" ").at(-1) : ""}
          </span>
        </h1>
        <p className="max-w-sm text-sm font-medium tracking-wide text-white/60 uppercase">
          Pick winners in 1v1 matches. Everyone&apos;s picks add up.
        </p>

        {unfinished.length > 0 && (
          <ul className="flex w-full flex-col gap-2">
            {unfinished.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tournaments/${t.id}`}
                  className="flex items-center justify-between gap-3 border-2 border-[#ff8a00] bg-[#ff8a00]/10 px-4 py-3 text-left font-arcade uppercase tracking-wide hover:bg-[#ff8a00]/25"
                >
                  <span>
                    Continue? <span className="text-[#ff8a00]">{t.scopeName}</span>
                  </span>
                  <span className="text-sm text-white/70">
                    {t.matchesLeft} left · {t.rated ? "Rated" : "Unrated"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/tournaments/new"
          className="group relative mt-2 w-full -skew-x-12 bg-[#ff2e88] px-6 py-5 font-arcade text-3xl uppercase tracking-wider shadow-[6px_6px_0_#ff8a00] transition active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          <span className="inline-block skew-x-12">▶ Start tournament</span>
        </Link>
        <nav className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
          {menu.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex items-center justify-between -skew-x-12 border-2 border-white/20 bg-white/5 px-5 py-3 transition hover:border-[#ff2e88] hover:bg-[#ff2e88]/10 sm:flex-col sm:items-start"
            >
              <span className="skew-x-12 font-arcade text-xl uppercase">{m.label}</span>
              <span className="skew-x-12 text-xs tracking-widest text-[#ff8a00] uppercase">{m.hint}</span>
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}

/** B: dark gacha lobby, a glowing holo "pull" banner card and bubbly neon-pastel tiles. */
export function VariantGacha({ appName, unfinished }: HomeProps) {
  const tiles = [
    { href: "/infinite", label: "Infinite Mode", emoji: "♾️", glow: "ring-[#ff9ec7]/50 shadow-[0_0_24px_-6px_#ff9ec7]" },
    { href: "/rankings", label: "Rankings", emoji: "🏆", glow: "ring-[#ffc79e]/50 shadow-[0_0_24px_-6px_#ffc79e]" },
    { href: "/categories", label: "Categories", emoji: "🎀", glow: "ring-[#c3a6ff]/50 shadow-[0_0_24px_-6px_#c3a6ff]" },
  ];
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-6 pb-28">
      <header className="flex flex-col items-center gap-1 text-center">
        <span className="rounded-full bg-[#ff9ec7]/15 px-3 py-1 text-xs font-medium tracking-wide text-[#ffb8d6] ring-1 ring-[#ff9ec7]/40">
          ✿ daily picks open ✿
        </span>
        <h1 className="bg-gradient-to-r from-[#ffb8d6] via-[#ffd2b0] to-[#d4bfff] bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
          {appName}
        </h1>
        <p className="text-[#d9c6ee]">Pick winners in 1v1 matches and see how everyone&apos;s picks add up.</p>
      </header>

      {unfinished.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {unfinished.map((t) => (
            <Link
              key={t.id}
              href={`/tournaments/${t.id}`}
              className="flex shrink-0 items-center gap-3 rounded-3xl bg-white/8 px-4 py-3 ring-2 ring-[#ffc79e]/50 shadow-[0_0_24px_-8px_#ffc79e] transition active:scale-95"
            >
              <span className="grid size-10 place-items-center rounded-2xl bg-[#ffc79e]/20 text-lg">⏳</span>
              <span className="flex flex-col">
                <span className="font-semibold">{t.scopeName}</span>
                <span className="text-xs text-[#d9c6ee]">
                  {t.matchesLeft} left · {t.rated ? "Rated" : "Unrated"} · tap to resume
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/tournaments/new"
        className="group relative block animate-float rounded-[2rem] holo-frame animate-holo p-1.5 shadow-[0_0_60px_-10px_rgb(220_140_255/0.7)] transition active:scale-[0.97]"
      >
        <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-[#2a1a4a] to-[#1b1233] px-6 py-10 text-center">
          <div aria-hidden className="holo-sheen absolute inset-0 animate-holo" />
          <span className="text-5xl drop-shadow-[0_0_16px_#ff9ec7]">🎴</span>
          <span className="relative text-3xl font-semibold text-white">Play a tournament</span>
          <span className="relative text-sm text-[#d9c6ee]">Pull a bracket · pick your favourites</span>
          <span className="relative mt-2 rounded-full bg-gradient-to-r from-[#ff9ec7] to-[#c3a6ff] px-6 py-2 font-semibold text-[#2a1440] shadow-[0_0_20px_-2px_#ff9ec7]">
            Pull ✦
          </span>
        </div>
      </Link>

      <nav className="grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-3xl bg-white/6 text-center text-sm font-medium ring-2 ${t.glow} transition hover:-translate-y-0.5 active:scale-90`}
          >
            <span className="text-3xl">{t.emoji}</span>
            {t.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

/** C: dark editorial cover, a huge off-white serif headline, an index of sections set off by thin rules. */
export function VariantEditorial({ appName, unfinished }: HomeProps) {
  const sections = [
    { href: "/tournaments/new", n: "01", label: "Play a tournament", dek: "A bracket of contestants, decided one pick at a time." },
    { href: "/infinite", n: "02", label: "Infinite Mode", dek: "One pair after another, for as long as you like." },
    { href: "/rankings", n: "03", label: "The Rankings", dek: "How everyone's picks add up, refreshed every five minutes." },
    { href: "/categories", n: "04", label: "Categories", dek: "Browse the collections, or start your own." },
  ];
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 pt-10 pb-28 md:px-10">
      <p className="text-[11px] tracking-[0.25em] text-[#a39a8c] uppercase">Issue of the day · Vol. II</p>
      <h1 className="mt-3 font-serif text-[3.4rem] leading-[0.95] font-light tracking-tight md:text-8xl">
        {appName.split(" ").slice(0, -1).join(" ")} <em className="font-normal text-[#e8c9a0]">{appName.split(" ").at(-1)}</em>
      </h1>
      <p className="mt-5 max-w-md text-lg leading-snug text-[#cfc6b8]">
        Pick winners in one-on-one matches, and see how everyone&apos;s picks add up.
      </p>

      {unfinished.length > 0 && (
        <aside className="mt-8 border-y border-[#efe8dc]/70 py-3">
          <p className="text-[11px] tracking-[0.25em] text-[#a39a8c] uppercase">Where you left off</p>
          {unfinished.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}`} className="mt-1 flex items-baseline justify-between gap-3 hover:underline">
              <span className="font-serif text-xl italic">{t.scopeName}</span>
              <span className="text-sm text-[#cfc6b8]">
                {t.matchesLeft} left, {t.rated ? "rated" : "unrated"} →
              </span>
            </Link>
          ))}
        </aside>
      )}

      <ol className="mt-10 border-t border-[#efe8dc]/70">
        {sections.map((s) => (
          <li key={s.href} className="border-b border-[#efe8dc]/15">
            <Link href={s.href} className="group grid grid-cols-[3rem_1fr_auto] items-baseline gap-3 py-5">
              <span className="font-serif text-sm text-[#a39a8c] tabular-nums">{s.n}</span>
              <span>
                <span className="block font-serif text-2xl leading-tight group-hover:italic md:text-3xl">{s.label}</span>
                <span className="mt-1 block text-sm text-[#a39a8c]">{s.dek}</span>
              </span>
              <span className="text-xl transition group-hover:translate-x-1">→</span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
