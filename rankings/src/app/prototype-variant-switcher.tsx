"use client";

import { useEffect } from "react";
import { VARIANT_NAMES, VARIANTS, type Variant } from "@/lib/prototype-variant";

/**
 * PROTOTYPE: floating bar to flip between visual directions. A full reload (not router.replace) so the
 * root layout, which doesn't re-render on navigation, picks up the new variant too.
 */
export function PrototypeVariantSwitcher({ current }: { current: Variant }) {
  const go = (step: number) => {
    const next = VARIANTS[(VARIANTS.indexOf(current) + step + VARIANTS.length) % VARIANTS.length];
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.location.replace(url);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      data-prototype-switcher
      className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/90 p-1 font-mono text-xs text-white shadow-2xl ring-2 ring-lime-400"
    >
      <button type="button" onClick={() => go(-1)} aria-label="Previous variant" className="rounded-full px-3 py-2 hover:bg-white/15">
        ←
      </button>
      <span className="min-w-36 px-1 text-center whitespace-nowrap">
        {current === "current" ? "—" : current} ({VARIANT_NAMES[current]})
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Next variant" className="rounded-full px-3 py-2 hover:bg-white/15">
        →
      </button>
    </div>
  );
}
