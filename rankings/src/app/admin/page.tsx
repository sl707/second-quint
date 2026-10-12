import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminError, isAdmin, listOpenReports, previewMerge, type MergeCandidate, type OpenReport } from "@/server/admin";
import { closeReportAction, mergeContestantsAction } from "./actions";

export const metadata: Metadata = { title: "Admin" };

const TARGET_LABELS: Record<OpenReport["targetType"], string> = {
  contestant: "Contestant",
  category: "Category",
  profile: "Profile",
};

const sectionHeading = "text-sm font-medium uppercase tracking-wide text-zinc-500";

/**
 * The admin's report queue and contestant merging; everyone else gets "not found".
 * `?duplicate=…&survivor=…` (contestant links or IDs) shows a merge to confirm.
 */
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const db = createAdminClient();
  const player = await readSignedInPlayer();
  if (!(await isAdmin(db, player))) notFound();
  const reports = await listOpenReports(db, player);
  const params = await searchParams;
  const [duplicateInput, survivorInput] = [params.duplicate, params.survivor].map((v) => (typeof v === "string" ? v.trim() : ""));
  const merge = duplicateInput || survivorInput ? await previewMerge(db, player, duplicateInput, survivorInput).catch(refusal) : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-zinc-600">
          Open the reported item to edit or delete it, then resolve the report. Dismiss reports that need no action.
        </p>
      </header>

      <section aria-labelledby="reports-heading" className="flex flex-col gap-3">
        <h2 id="reports-heading" className={sectionHeading}>
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

      <section aria-labelledby="merge-heading" className="flex flex-col gap-3">
        <h2 id="merge-heading" className={sectionHeading}>
          Merge duplicate contestants
        </h2>
        <p className="text-sm text-zinc-600">
          The duplicate&apos;s matches and categories move to the survivor, matches between the two are dropped, and the
          duplicate&apos;s page sends visitors to the survivor&apos;s. Rankings catch up at the next refresh.
        </p>
        <form action="/admin" className="flex flex-col gap-2">
          <MergeInput name="duplicate" label="Duplicate (contestant link or ID)" defaultValue={duplicateInput} />
          <MergeInput name="survivor" label="Survivor (contestant link or ID)" defaultValue={survivorInput} />
          <button type="submit" className="self-start rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800">
            Review merge
          </button>
        </form>
        {merge && "error" in merge && (
          <p role="alert" className="text-sm text-red-800">
            {merge.error}
          </p>
        )}
        {merge && "duplicate" in merge && (
          <form
            action={mergeContestantsAction.bind(null, merge.duplicate.id, merge.survivor.id)}
            className="flex flex-col gap-3 rounded-xl border border-red-200 bg-white px-4 py-3"
          >
            <div className="flex flex-col gap-2">
              <MergeSide role="Duplicate, goes away" candidate={merge.duplicate} />
              <MergeSide role="Survivor, keeps both histories" candidate={merge.survivor} />
            </div>
            <button type="submit" className="self-start rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white">
              Merge {merge.duplicate.name} into {merge.survivor.name}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function refusal(error: unknown): { error: string } {
  if (error instanceof AdminError) return { error: error.message };
  throw error;
}

function MergeInput({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-600">
      <span>{label}</span>
      <input
        name={name}
        required
        defaultValue={defaultValue}
        autoComplete="off"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
      />
    </label>
  );
}

function MergeSide({ role, candidate }: { role: string; candidate: MergeCandidate }) {
  return (
    <p className="flex items-center gap-3">
      <Image src={candidate.picture128Url} alt="" width={128} height={128} className="size-10 rounded-lg object-cover" />
      <span className="flex flex-col">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{role}</span>
        <Link href={`/contestants/${candidate.id}`} className="font-medium underline">
          {candidate.name}
        </Link>
      </span>
    </p>
  );
}
