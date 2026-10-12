"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

/** Time left until the rated allowance resets at midnight in New York; reloads the page when it does. */
export function AllowanceCountdown({ resetsAt, renderedAt }: { resetsAt: string; renderedAt: string }) {
  const router = useRouter();
  const reset = Date.parse(resetsAt);
  const [now, setNow] = useState(() => Date.parse(renderedAt));

  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= reset) {
        clearInterval(timer);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [reset, router]);

  return (
    <span role="timer" aria-label="Time until the rated allowance resets">
      {formatCountdown(reset - now)}
    </span>
  );
}
