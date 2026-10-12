import type { ComponentProps, ReactNode } from "react";

export type PlateTone = "default" | "accent" | "warn" | "danger";

const tones: Record<PlateTone, string> = {
  default: "border-edge",
  accent: "border-pink",
  warn: "border-orange",
  danger: "border-danger",
};

/** A solid dark panel with a coloured edge: the surface every block of text sits on. */
export function plateClass(tone: PlateTone = "default", className = "") {
  return `border-2 bg-plate ${tones[tone]} ${className}`;
}

export function Plate({ tone, className = "", ...props }: ComponentProps<"div"> & { tone?: PlateTone }) {
  return <div className={plateClass(tone, `p-4 ${className}`)} {...props} />;
}

/** A message on a plate: why something can't happen, or what happens next. */
export function Notice({ tone = "default", className = "", children, ...props }: ComponentProps<"p"> & { tone?: PlateTone }) {
  return (
    <p className={plateClass(tone, `px-4 py-3 text-zinc-100 ${className}`)} {...props}>
      {children}
    </p>
  );
}

/** An error message from a form, announced as an alert. */
export function Alert({ children, className = "", ...props }: ComponentProps<"p">) {
  return (
    <p role="alert" className={`border-l-4 border-danger bg-plate px-4 py-3 font-medium text-danger empty:hidden ${className}`} {...props}>
      {children}
    </p>
  );
}

/** A `<details>` on a plate; the summary label is its own element so it can be found by its exact text. */
export function Disclosure({
  summary,
  tone = "default",
  className = "",
  children,
}: {
  summary: string;
  tone?: PlateTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={plateClass(tone, `group px-4 py-3 ${className}`)}>
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 font-display text-lg uppercase tracking-wide select-none [&::-webkit-details-marker]:hidden ${tone === "danger" ? "text-danger" : "text-white"}`}
      >
        <span aria-hidden className="inline-block text-sm transition group-open:rotate-90">
          ▶
        </span>
        <span>{summary}</span>
      </summary>
      <div className="pt-4">{children}</div>
    </details>
  );
}
