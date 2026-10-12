import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readSignedInPlayer } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AdminError,
  getTournamentCompletion,
  isAdmin,
  listOpenReports,
  previewMerge,
  type MergeCandidate,
  type OpenReport,
} from "@/server/admin";
import { closeReportAction, mergeContestantsAction } from "./actions";
import { Button, inlineLinkClass } from "../ui/button";
import { Chip } from "../ui/chip";
import { ContestantThumb } from "../ui/contestant-image";
import { Field, inputClass } from "../ui/field";
import { eyebrowClass, Page, PageHeader, SectionTitle } from "../ui/frame";
import { Alert, Notice, plateClass } from "../ui/plate";
import { TournamentCompletionView } from "./completion";

export const metadata: Metadata = { title: "Admin" };

const TARGET_LABELS: Record<OpenReport["targetType"], string> = {
  contestant: "Contestant",
  category: "Category",
  profile: "Profile",
};

/**
 * The admin's report queue, contestant merging, and tournament completion; everyone else gets "not found".
 * `?duplicate=…&survivor=…` (contestant links or IDs) shows a merge to confirm; `?from=…&to=…`
 * (`YYYY-MM-DD`) limits tournament completion to tournaments started in that range.
 */
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const db = createAdminClient();
  const player = await readSignedInPlayer();
  if (!(await isAdmin(db, player))) notFound();
  const reports = await listOpenReports(db, player);
  const params = await searchParams;
  const [duplicateInput, survivorInput] = [params.duplicate, params.survivor].map((v) => (typeof v === "string" ? v.trim() : ""));
  const merge = duplicateInput || survivorInput ? await previewMerge(db, player, duplicateInput, survivorInput).catch(refusal) : null;
  const [from, to] = [params.from, params.to].map((v) => (typeof v === "string" ? v : ""));
  const completion = await getTournamentCompletion(db, player, { from, to });

  return (
    <Page>
      <PageHeader kicker="Admin only" title="Admin" neon>
        <p>Open the reported item to edit or delete it, then resolve the report. Dismiss reports that need no action.</p>
      </PageHeader>

      <section aria-labelledby="reports-heading" className="flex flex-col gap-3">
        <SectionTitle id="reports-heading">Open reports ({reports.length})</SectionTitle>
        {reports.length > 0 ? (
          <ul aria-labelledby="reports-heading" className="flex flex-col gap-2">
            {reports.map((r) => (
              <li key={r.id} className={plateClass("warn", "flex flex-col gap-2 px-4 py-3")}>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Chip tone="orange">{TARGET_LABELS[r.targetType]}</Chip>
                  {r.target ? (
                    <Link href={r.target.href} className={inlineLinkClass}>
                      {r.target.name}
                    </Link>
                  ) : (
                    <span className="text-muted">Deleted</span>
                  )}
                </p>
                <p className="text-zinc-100">{r.reason}</p>
                <p className="text-xs text-muted">
                  {r.reporter ? `By ${r.reporter.displayName}` : "By a signed-out visitor"} ·{" "}
                  {new Date(r.reportedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" })}
                </p>
                <div className="flex gap-3 pt-1">
                  <form action={closeReportAction.bind(null, r.id, "resolved")}>
                    <Button size="sm">Resolve</Button>
                  </form>
                  <form action={closeReportAction.bind(null, r.id, "dismissed")}>
                    <Button size="sm" variant="secondary">
                      Dismiss
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Notice>No open reports.</Notice>
        )}
      </section>

      <section aria-labelledby="merge-heading" className="flex flex-col gap-3">
        <SectionTitle id="merge-heading">Merge duplicate contestants</SectionTitle>
        <p className="text-sm text-muted">
          The duplicate&apos;s matches and categories move to the survivor, matches between the two are dropped, and the
          duplicate&apos;s page sends visitors to the survivor&apos;s. Rankings catch up at the next refresh.
        </p>
        <form action="/admin" className="flex flex-col gap-3">
          <MergeInput name="duplicate" label="Duplicate (contestant link or ID)" defaultValue={duplicateInput} />
          <MergeInput name="survivor" label="Survivor (contestant link or ID)" defaultValue={survivorInput} />
          <Button variant="secondary" size="sm" className="self-start">
            Review merge
          </Button>
        </form>
        {merge && "error" in merge && <Alert>{merge.error}</Alert>}
        {merge && "duplicate" in merge && (
          <form
            action={mergeContestantsAction.bind(null, merge.duplicate.id, merge.survivor.id)}
            className={plateClass("danger", "flex flex-col gap-3 px-4 py-3")}
          >
            <div className="flex flex-col gap-2">
              <MergeSide role="Duplicate, goes away" candidate={merge.duplicate} />
              <MergeSide role="Survivor, keeps both histories" candidate={merge.survivor} />
            </div>
            <Button variant="danger" size="sm" className="self-start">
              Merge {merge.duplicate.name} into {merge.survivor.name}
            </Button>
          </form>
        )}
      </section>

      <TournamentCompletionView completion={completion} from={from} to={to} />
    </Page>
  );
}

function refusal(error: unknown): { error: string } {
  if (error instanceof AdminError) return { error: error.message };
  throw error;
}

function MergeInput({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <Field label={label}>
      <input name={name} required defaultValue={defaultValue} autoComplete="off" className={inputClass} />
    </Field>
  );
}

function MergeSide({ role, candidate }: { role: string; candidate: MergeCandidate }) {
  return (
    <p className="flex items-center gap-3">
      <ContestantThumb src={candidate.picture128Url} />
      <span className="flex flex-col">
        <span className={eyebrowClass}>{role}</span>
        <Link href={`/contestants/${candidate.id}`} className={inlineLinkClass}>
          {candidate.name}
        </Link>
      </span>
    </p>
  );
}
