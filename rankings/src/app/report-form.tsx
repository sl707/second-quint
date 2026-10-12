"use client";

import { useActionState } from "react";
import { MAX_REPORT_REASON_LENGTH } from "@/domain/catalog/permissions";
import type { ReportTargetType } from "@/server/catalog";
import { reportAction } from "./report-actions";
import { Button } from "./ui/button";
import { inputClass } from "./ui/field";
import { Alert } from "./ui/plate";

/** "Report" on a contestant, category, or profile: a short reason sent to the admin. */
export function ReportForm({ targetType, targetId, label }: { targetType: ReportTargetType; targetId: string; label: string }) {
  const [state, action, pending] = useActionState(reportAction.bind(null, targetType, targetId), { error: null, sent: false });

  return (
    <details className="group text-sm text-muted">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 font-semibold tracking-wider uppercase select-none hover:text-orange-bright [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-xs transition group-open:rotate-90">
          ▶
        </span>
        <span>Report</span>
      </summary>
      {state.sent ? (
        <p role="status" className="pt-3 text-zinc-100">
          Thanks, the admin will take a look.
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-3 pt-3">
          <label className="flex flex-col gap-2">
            <span className="text-zinc-100">What&apos;s wrong with {label}?</span>
            <input name="reason" required maxLength={MAX_REPORT_REASON_LENGTH} autoComplete="off" className={inputClass} />
          </label>
          {state.error && <Alert>{state.error}</Alert>}
          <Button variant="secondary" size="sm" disabled={pending} className="self-start">
            Send report
          </Button>
        </form>
      )}
    </details>
  );
}
