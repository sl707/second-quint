import { HUMAN_CHECK_NOT_SET_UP } from "@/server/human-check";
import { TurnstileWidget } from "./turnstile-widget";
import { Notice } from "./ui/plate";

/** Shown to a signed-out visitor in place of play until they pass Cloudflare Turnstile. */
export function HumanCheck() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) {
    return <Notice tone="warn">{HUMAN_CHECK_NOT_SET_UP}</Notice>;
  }
  return <TurnstileWidget siteKey={siteKey} />;
}
