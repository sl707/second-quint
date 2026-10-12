import { HUMAN_CHECK_NOT_SET_UP } from "@/server/human-check";
import { TurnstileWidget } from "./turnstile-widget";

/** Shown to a signed-out visitor in place of play until they pass Cloudflare Turnstile. */
export function HumanCheck() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) {
    return <p className="rounded-xl border border-zinc-200 bg-white p-4 text-zinc-700">{HUMAN_CHECK_NOT_SET_UP}</p>;
  }
  return <TurnstileWidget siteKey={siteKey} />;
}
