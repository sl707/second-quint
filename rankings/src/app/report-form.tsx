"use client";

import { useActionState } from "react";
import { MAX_REPORT_REASON_LENGTH } from "@/domain/catalog/permissions";
import type { ReportTargetType } from "@/server/catalog";
import { reportAction } from "./report-actions";

/** "Report" on a contestant, category, or profile: a short reason sent to the admin. */
export function ReportForm({ targetType, targetId, label }: { targetType: ReportTargetType; targetId: string; label: string }) {
  const [state, action, pending] = useActionState(reportAction.bind(null, targetType, targetId), { error: null, sent: false });

  return (
    <details className="text-sm text-zinc-600">
      <summary className="cursor-pointer select-none">Report</summary>
      {state.sent ? (
        <p role="status" className="pt-2">
          Thanks, the admin will take a look.
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-2 pt-2">
          <label className="flex flex-col gap-1">
            <span>What&apos;s wrong with {label}?</span>
            <input
              name="reason"
              required
              maxLength={MAX_REPORT_REASON_LENGTH}
              autoComplete="off"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
            />
          </label>
          {state.error && (
            <p role="alert" className="text-red-800">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-800 disabled:opacity-50"
          >
            Send report
          </button>
        </form>
      )}
    </details>
  );
}
