import Link from "next/link";
import type { ReactNode } from "react";

const tones = {
  pink: "bg-pink text-black",
  orange: "bg-orange text-black",
  neutral: "border border-edge bg-raised text-white",
};

/** A small slanted label. */
export function Chip({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex -skew-x-12 px-2 py-0.5 text-xs font-bold tracking-wider uppercase ${tones[tone]}`}>
      <span className="skew-x-12">{children}</span>
    </span>
  );
}

/** Whether a tournament or Infinite Mode pick is rated. */
export function RatedChip({ rated }: { rated: boolean }) {
  return <Chip tone={rated ? "pink" : "neutral"}>{rated ? "Rated" : "Unrated"}</Chip>;
}

/** A row of chip links where one is the current page, such as a personal ranking's scopes. */
export function ChipNav({ label, items }: { label: string; items: { key: string; href: string; label: string; current: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.current ? "page" : undefined}
          className={`-skew-x-12 px-3 py-1.5 text-sm font-semibold ${
            item.current ? "bg-orange text-black" : "border-2 border-edge bg-plate text-white hover:border-orange"
          }`}
        >
          <span className="inline-block skew-x-12">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Two or more links shown as a segmented switch, such as Rated / Unrated. */
export function SegmentedLinks({ label, items }: { label: string; items: { href: string; label: string; current: boolean }[] }) {
  return (
    <nav aria-label={label} className="grid auto-cols-fr grid-flow-col gap-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.current ? "page" : undefined}
          className={`-skew-x-12 py-2 text-center font-display text-lg tracking-widest uppercase ${
            item.current ? "bg-pink text-black" : "border-2 border-edge bg-plate text-white hover:border-pink"
          }`}
        >
          <span className="inline-block skew-x-12">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
