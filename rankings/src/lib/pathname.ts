/** Request header the proxy sets so the root layout knows which page is rendering. */
export const PATHNAME_HEADER = "x-sq-pathname";

/** `next` if it's a path on this site, else "/", so sign-in can't redirect elsewhere. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
