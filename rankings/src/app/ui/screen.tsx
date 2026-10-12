import type { ReactNode } from "react";

/** A centered full-page message in the arcade style: the 404, error, and loading screens. */
export function Screen({ code, title, children }: { code: string; title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-5 py-16 text-center">
      <p aria-hidden className="font-display text-8xl leading-none text-pink-bright italic drop-shadow-[0_0_18px_var(--color-pink)]">
        {code}
      </p>
      <h1 className="font-display text-4xl leading-none uppercase italic">{title}</h1>
      {children}
    </main>
  );
}
