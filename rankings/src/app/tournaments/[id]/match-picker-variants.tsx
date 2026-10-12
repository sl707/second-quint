"use client";

// PROTOTYPE: the match picker and undo button in each visual direction, wired to the real server actions.
import Image from "next/image";
import { useActionState } from "react";
import type { ContestantCard } from "@/server/game";
import { pickWinnerAction, undoLastPickAction } from "../actions";

type PickerProps = { tournamentId: string; matchIndex: number; contestants: ContestantCard[] };

function PickFields({ tournamentId, matchIndex, contestant }: { tournamentId: string; matchIndex: number; contestant: ContestantCard }) {
  return (
    <>
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <input type="hidden" name="matchIndex" value={matchIndex} />
      <input type="hidden" name="winnerId" value={contestant.id} />
    </>
  );
}

/** A: fighting-game split screen, two full-bleed panels with a slanted divider and a slammed VS. */
export function PickerArcade({ tournamentId, matchIndex, contestants }: PickerProps) {
  const [state, action] = useActionState(pickWinnerAction, { message: null });
  const sides = [
    { clip: "[clip-path:polygon(0_0,100%_0,84%_100%,0_100%)]", tint: "from-[#ff2e88]", label: "P1", labelColor: "text-[#ff4f9a]", align: "items-start text-left pl-3" },
    { clip: "[clip-path:polygon(16%_0,100%_0,100%_100%,0_100%)]", tint: "from-[#ff8a00]", label: "P2", labelColor: "text-[#ff9a26]", align: "items-end text-right pr-3" },
  ];
  return (
    <>
      <div className="relative flex h-[min(64svh,560px)] w-full">
        {contestants.map((contestant, i) => (
          <form key={contestant.id} action={action} className={`relative h-full flex-1 ${i === 1 ? "-ml-[10%]" : ""} ${sides[i].clip}`}>
            <PickFields tournamentId={tournamentId} matchIndex={matchIndex} contestant={contestant} />
            <button
              type="submit"
              aria-label={`Pick ${contestant.name}`}
              className="group relative flex h-full w-full flex-col overflow-hidden bg-black"
            >
              <span className="relative block flex-1 overflow-hidden">
                <Image
                  src={contestant.picture512Url}
                  alt=""
                  fill
                  priority
                  sizes="50vw"
                  className="object-cover transition duration-300 group-hover:scale-105 group-active:scale-110"
                />
                <span className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${sides[i].tint} to-transparent`} />
                <span className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black from-45% via-black/95 via-60% to-transparent" />
              </span>
              <span className={`flex flex-col gap-1 bg-black pt-1 pb-4 ${sides[i].align} ${i === 0 ? "pr-[18%]" : "pl-[18%]"}`}>
                <span className={`text-[13px] font-bold tracking-[0.2em] ${sides[i].labelColor}`}>{sides[i].label}</span>
                <span className="font-arcade text-3xl leading-none text-white uppercase italic md:text-5xl">{contestant.name}</span>
              </span>
              <span className="absolute inset-0 ring-0 ring-white transition group-active:ring-8 group-active:ring-inset" />
            </button>
          </form>
        ))}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <span className="block animate-slam font-arcade text-7xl text-white italic [-webkit-text-stroke:3px_#000] drop-shadow-[0_0_18px_#ff2e88] md:text-9xl">
            VS
          </span>
        </span>
      </div>
      <p className="text-center text-sm font-semibold tracking-[0.2em] text-zinc-300 uppercase">Tap a fighter to pick</p>
      {state.message && (
        <p role="status" className="mx-4 border-2 border-[#ff2e88] bg-[#ff2e88]/15 p-3 text-center text-sm font-semibold">
          {state.message}
        </p>
      )}
    </>
  );
}

/** B: two tall collectible cards with holo frames that bounce when tapped. */
export function PickerGacha({ tournamentId, matchIndex, contestants }: PickerProps) {
  const [state, action] = useActionState(pickWinnerAction, { message: null });
  const frames = ["shadow-[0_0_40px_-8px_#ff9ec7]", "shadow-[0_0_40px_-8px_#c3a6ff]"];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:mx-auto md:max-w-2xl md:gap-8">
        {contestants.map((contestant, i) => (
          <form key={contestant.id} action={action}>
            <PickFields tournamentId={tournamentId} matchIndex={matchIndex} contestant={contestant} />
            <button
              type="submit"
              aria-label={`Pick ${contestant.name}`}
              className={`group relative block w-full rounded-[1.6rem] holo-frame animate-holo p-1 ${frames[i]} transition duration-200 ease-[cubic-bezier(.3,1.8,.5,1)] hover:-translate-y-1 hover:rotate-[-1deg] active:scale-90`}
            >
              <span className="relative flex aspect-[5/8] flex-col overflow-hidden rounded-[1.35rem] bg-[#1d1338]">
                <span className="relative m-2 mb-0 aspect-square overflow-hidden rounded-2xl">
                  <Image src={contestant.picture512Url} alt="" fill priority sizes="50vw" className="object-cover" />
                  <span aria-hidden className="holo-sheen absolute inset-0 animate-holo mix-blend-screen" />
                </span>
                <span className="flex flex-1 flex-col items-center justify-center gap-1 px-2 text-center">
                  <span className="text-xs tracking-widest text-[#ffc79e]">★★★★★</span>
                  <span className="text-lg leading-tight font-semibold text-white md:text-2xl">{contestant.name}</span>
                  <span className="mt-1 rounded-full bg-gradient-to-r from-[#ff9ec7] to-[#c3a6ff] px-3 py-0.5 text-xs font-semibold text-[#2a1440] opacity-90 group-hover:opacity-100">
                    Choose ♡
                  </span>
                </span>
              </span>
            </button>
          </form>
        ))}
      </div>
      {state.message && (
        <p role="status" className="rounded-2xl bg-[#ff9ec7]/15 p-3 text-center text-sm text-[#ffd6e8] ring-1 ring-[#ff9ec7]/40">
          {state.message}
        </p>
      )}
    </>
  );
}

/** C: two large full-bleed photographs side by side with serif captions; the picture is the button. */
export function PickerEditorial({ tournamentId, matchIndex, contestants }: PickerProps) {
  const [state, action] = useActionState(pickWinnerAction, { message: null });
  return (
    <>
      <div className="-mx-5 grid grid-cols-2 gap-px bg-[#efe8dc]/20 md:mx-0">
        {contestants.map((contestant, i) => (
          <form key={contestant.id} action={action} className="bg-[#171513]">
            <PickFields tournamentId={tournamentId} matchIndex={matchIndex} contestant={contestant} />
            <button type="submit" aria-label={`Pick ${contestant.name}`} className="group block w-full text-left">
              <span className="relative block aspect-[4/5] overflow-hidden">
                <Image
                  src={contestant.picture512Url}
                  alt=""
                  fill
                  priority
                  sizes="50vw"
                  className="object-cover grayscale-[35%] transition duration-500 group-hover:grayscale-0 group-active:scale-[1.02]"
                />
              </span>
              <span className={`flex flex-col gap-0.5 px-3 pt-3 pb-1 ${i === 1 ? "items-end text-right" : ""}`}>
                <span className="text-[10px] tracking-[0.25em] text-[#a39a8c] uppercase">{i === 0 ? "Left" : "Right"}</span>
                <span className="font-serif text-2xl leading-tight group-hover:italic md:text-4xl">{contestant.name}</span>
              </span>
            </button>
          </form>
        ))}
      </div>
      {state.message && (
        <p role="status" className="border-y border-[#efe8dc]/40 py-2 text-center font-serif italic">
          {state.message}
        </p>
      )}
    </>
  );
}

const undoLooks = {
  A: "-skew-x-12 border-2 border-white/40 px-6 py-2 font-arcade text-lg uppercase tracking-widest text-white hover:border-[#ff8a00] hover:text-[#ff8a00]",
  B: "rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-[#f3dcff] ring-1 ring-[#c3a6ff]/50 transition active:scale-90",
  C: "text-sm tracking-wide text-[#efe8dc] underline underline-offset-4 hover:text-[#e8c9a0]",
};

export function UndoVariant({ tournamentId, variant }: { tournamentId: string; variant: keyof typeof undoLooks }) {
  const [state, action] = useActionState(undoLastPickAction.bind(null, tournamentId), { message: null });
  return (
    <form action={action} className="flex flex-col items-center gap-2">
      <button type="submit" className={undoLooks[variant]}>
        {variant === "A" ? "↶ Rewind" : variant === "B" ? "↶ Undo" : "Undo last pick"}
      </button>
      {state.message && (
        <p role="status" className="max-w-sm text-center text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
