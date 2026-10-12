// PROTOTYPE (throwaway, branch prototype/ui-variants): three visual directions for the Rankings app,
// switchable with `?variant=A|B|C` on `/`, `/tournaments/[id]`, and the ranking pages. The proxy
// remembers the last `?variant=` in a cookie so it survives in-app navigation; `current` is today's UI.

export const VARIANTS = ["current", "A", "B", "C"] as const;
export type Variant = (typeof VARIANTS)[number];

export const VARIANT_NAMES: Record<Variant, string> = {
  current: "Current UI",
  A: "Arcade versus",
  B: "Gacha card",
  C: "Editorial",
};

export const VARIANT_HEADER = "x-sq-variant";
export const VARIANT_COOKIE = "sq-variant";

export function parseVariant(value: string | null | undefined): Variant | null {
  return VARIANTS.find((v) => v === value) ?? null;
}
