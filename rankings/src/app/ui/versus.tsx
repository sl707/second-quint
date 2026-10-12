import Image from "next/image";
import type { ReactNode } from "react";

type Side = { id: string; name: string; picture512Url: string };

const sides = [
  {
    clip: "[clip-path:polygon(0_0,100%_0,84%_100%,0_100%)]",
    stripe: "from-pink",
    label: "P1",
    labelColor: "text-pink-bright",
    caption: "items-start pr-[18%] pl-3 text-left",
  },
  {
    clip: "-ml-[10%] [clip-path:polygon(16%_0,100%_0,100%_100%,0_100%)]",
    stripe: "from-orange",
    label: "P2",
    labelColor: "text-orange-bright",
    caption: "items-end pr-3 pl-[18%] text-right",
  },
];

/**
 * The fighting-game split screen for a match: two full-height pick buttons with a slanted divider
 * and a slammed VS. Each side is its own form posting to `action` with `fields(contestant)`; the
 * name sits on a solid black plate under the picture.
 */
export function Versus({
  action,
  contestants,
  fields,
  disabled = false,
}: {
  action: (formData: FormData) => void;
  contestants: Side[];
  fields: (contestant: Side, index: number) => ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative mx-auto flex h-[min(62svh,560px)] w-full max-w-4xl">
        {contestants.map((contestant, i) => (
          <form key={contestant.id} action={action} className={`relative h-full min-w-0 flex-1 ${sides[i].clip}`}>
            {fields(contestant, i)}
            <button
              type="submit"
              disabled={disabled}
              aria-label={`Pick ${contestant.name}`}
              className="group relative flex h-full w-full flex-col overflow-hidden bg-black disabled:cursor-wait"
            >
              <span className="relative block flex-1 overflow-hidden">
                <Image
                  src={contestant.picture512Url}
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 896px) 448px, 55vw"
                  className="object-cover transition duration-300 group-hover:scale-105 group-active:scale-110 group-disabled:opacity-70"
                />
                <span className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${sides[i].stripe} to-transparent`} />
                <span className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black from-30% to-transparent" />
              </span>
              <span className={`flex min-h-24 flex-col justify-end gap-1 bg-black pt-1 pb-4 ${sides[i].caption}`}>
                <span aria-hidden className={`text-[13px] font-bold tracking-[0.2em] ${sides[i].labelColor}`}>
                  {sides[i].label}
                </span>
                <span className="line-clamp-2 pr-[0.15em] font-display text-2xl leading-none text-white uppercase italic [overflow-wrap:anywhere] md:text-4xl">
                  {contestant.name}
                </span>
              </span>
              <span className="pointer-events-none absolute inset-0 ring-white transition group-active:ring-8 group-active:ring-inset" />
            </button>
          </form>
        ))}
        <span aria-hidden className="pointer-events-none absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="block animate-slam font-display text-7xl text-white italic drop-shadow-[0_0_18px_var(--color-pink)] [-webkit-text-stroke:3px_#000] md:text-8xl">
            VS
          </span>
        </span>
      </div>
      <p className="text-center text-[13px] font-semibold tracking-[0.2em] text-muted uppercase">Tap a contestant to pick the winner</p>
    </div>
  );
}
