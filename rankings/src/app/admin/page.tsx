import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin, listOpenReports, type OpenReport } from "@/server/admin";
import { closeReportAction } from "./actions";

export const metadata: Metadata = { title: "Admin" };

const TARGET_LABELS: Record<OpenReport["targetType"], string> = {
  contestant: "Contestant",
  category: "Category",
  profile: "Profile",
};

/** The admin's report queue; everyone else gets "not found". */
export default async function AdminPage() {
  const db = createAdminClient();
  const player = await readSignedInPlayer();
  if (!(await isAdmin(db, player))) notFound();
  const reports = await listOpenReports(db, player);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-zinc-600">
          Open the reported item to edit or delete it, then resolve the report. Dismiss reports that need no action.
        </p>
      </header>

      <section aria-labelledby="reports-heading" className="flex flex-col gap-3">
        <h2 id="reports-heading" className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Open reports ({reports.length})
        </h2>
        {reports.length > 0 ? (
          <ul aria-labelledby="reports-heading" className="flex flex-col gap-2">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{TARGET_LABELS[r.targetType]}</span>
                  {r.target ? (
                    <Link href={r.target.href} className="font-medium underline">
                      {r.target.name}
                    </Link>
                  ) : (
                    <span className="text-zinc-500">Deleted</span>
                  )}
                </p>
                <p className="text-zinc-800">{r.reason}</p>
                <p className="text-xs text-zinc-500">
                  {r.reporter ? `By ${r.reporter.displayName}` : "By a signed-out visitor"} ·{" "}
                  {new Date(r.reportedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" })}
                </p>
                <div className="flex gap-2">
                  <form action={closeReportAction.bind(null, r.id, "resolved")}>
                    <button type="submit" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">
                      Resolve
                    </button>
                  </form>
                  <form action={closeReportAction.bind(null, r.id, "dismissed")}>
                    <button type="submit" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700">
                      Dismiss
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-600">No open reports.</p>
        )}
      </section>
    </main>
  );
}
