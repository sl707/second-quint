import Link from "next/link";
import type { ReactNode } from "react";

const widths = {
  narrow: "max-w-xl md:max-w-2xl",
  wide: "max-w-5xl",
};

/** A page's `<main>`: phone-first column, wider on desktop. */
export function Page({ width = "narrow", className = "", children }: { width?: keyof typeof widths; className?: string; children: ReactNode }) {
  return <main className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 pt-6 pb-16 md:px-6 ${widths[width]} ${className}`}>{children}</main>;
}

/** The page title in the condensed display face, with an optional back link, kicker above, and blurb below. */
export function PageHeader({
  back,
  kicker,
  title,
  neon = false,
  children,
}: {
  back?: { href: string; label: string };
  kicker?: ReactNode;
  title: ReactNode;
  neon?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      {back && (
        <Link href={back.href} className="self-start text-[13px] font-semibold tracking-[0.2em] text-muted uppercase hover:text-orange-bright">
          ← {back.label}
        </Link>
      )}
      {kicker && <p className="text-[13px] font-semibold tracking-[0.2em] text-orange-bright uppercase">{kicker}</p>}
      <h1 className="font-display text-4xl leading-none uppercase italic [overflow-wrap:anywhere] md:text-5xl">
        {neon ? <span className="animate-neon">{title}</span> : title}
      </h1>
      {children && <div className="flex flex-col gap-1 text-sm text-muted">{children}</div>}
    </header>
  );
}

/** A section title in the display face; `id` lets the section and its list be labelled by it. */
export function SectionTitle({ id, as: Tag = "h2", children }: { id?: string; as?: "h2" | "h3"; children: ReactNode }) {
  return (
    <Tag id={id} className={`font-display uppercase italic ${Tag === "h2" ? "text-2xl md:text-3xl" : "text-xl"}`}>
      {children}
    </Tag>
  );
}

/** A small orange label: field names, column headings, eyebrows. */
export const eyebrowClass = "text-[13px] font-semibold tracking-[0.2em] text-orange-bright uppercase";
