"use client";

import Script from "next/script";
import { useEffect, useRef, useState, useTransition } from "react";
import { verifyVisitorAction } from "./human-check-actions";

type Turnstile = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: "always" | "execute" | "interaction-only";
      callback: (token: string) => void;
      "error-callback": () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

/** Cloudflare Turnstile, visible only when it needs the visitor to interact. */
export function TurnstileWidget({ siteKey }: { siteKey: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const turnstile = window.turnstile;
    if (!loaded || !turnstile || !container.current) return;
    const widgetId = turnstile.render(container.current, {
      sitekey: siteKey,
      appearance: "interaction-only",
      callback: (token) =>
        startTransition(async () => {
          const result = await verifyVisitorAction(token);
          if (result.error) {
            setError(result.error);
            turnstile.reset(widgetId);
          }
        }),
      "error-callback": () => setError("The human check couldn't run. Reload the page, or sign in to play."),
    });
    return () => turnstile.remove(widgetId);
  }, [loaded, siteKey]);

  return (
    <section aria-label="Human check" className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setLoaded(true)}
        onError={() => setError("The human check couldn't load. Reload the page, or sign in to play.")}
      />
      <p role="status" className="text-center text-sm text-zinc-600">
        {error ?? "Checking you're human before you play…"}
      </p>
      <div ref={container} />
    </section>
  );
}
