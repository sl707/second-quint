import Link from "next/link";
import type { ReactNode } from "react";
import { ContestantThumb } from "./contestant-image";

const topNumeral = [
  "text-pink-bright drop-shadow-[0_0_10px_var(--color-pink)]",
  "text-orange-bright drop-shadow-[0_0_10px_var(--color-orange)]",
  "text-gold",
];

/**
 * One contestant in a ranking: position, picture, name, and on the right the Score with its detail.
 * The top three stand out on a raised plate with big neon numerals.
 */
export function RankRow({
  position,
  contestant,
  score,
  detail,
}: {
  position: number;
  contestant: { id: string; name: string; picture128Url: string };
  score: number;
  detail: ReactNode;
}) {
  const top = position <= 3 ? position - 1 : null;
  return (
    <li
      className={`grid grid-cols-[3rem_1fr_auto] items-center gap-3 border-b border-edge py-2 pr-2 ${
        top !== null ? "border-l-4 border-l-pink bg-raised" : "pl-1"
      }`}
    >
      <span
        className={`text-center font-display leading-none italic tabular-nums ${top !== null ? `text-4xl ${topNumeral[top]}` : "text-2xl text-zinc-300"}`}
      >
        {position}
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <ContestantThumb src={contestant.picture128Url} size={top !== null ? "lg" : "md"} framed={top !== null} />
        <Link href={`/contestants/${contestant.id}`} className="truncate font-display text-lg uppercase hover:text-orange-bright md:text-xl">
          {contestant.name}
        </Link>
      </span>
      <span className="text-right">
        <span className="block font-display text-2xl leading-none text-orange-bright tabular-nums">{Math.round(score)}</span>
        <span className="block text-xs whitespace-nowrap text-muted">{detail}</span>
      </span>
    </li>
  );
}
