import type { CompletionCounts, TournamentCompletion } from "@/server/admin";
import { Button } from "../ui/button";
import { Field, inputClass } from "../ui/field";
import { SectionTitle } from "../ui/frame";
import { Notice } from "../ui/plate";

const STATUSES: { key: keyof Omit<CompletionCounts, "total">; label: string }[] = [
  { key: "finished", label: "Finished" },
  { key: "givenUp", label: "Given up" },
  { key: "inProgress", label: "In progress" },
  { key: "removed", label: "Removed" },
];

const cell = "px-3 py-2 text-right tabular-nums";
const headerCell = "px-3 py-2 text-right text-[13px] font-semibold uppercase tracking-wider text-orange-bright";

function share(count: number, total: number) {
  return total ? `${Math.round((count / total) * 100)}%` : "—";
}

/** The admin's view of how often tournaments get finished, started in the chosen date range. */
export function TournamentCompletionView({
  completion,
  from,
  to,
}: {
  completion: TournamentCompletion;
  from: string;
  to: string;
}) {
  const groups = [
    { label: "All", counts: completion.overall },
    { label: "Rated", counts: completion.rated },
    { label: "Unrated", counts: completion.unrated },
  ];

  return (
    <section aria-labelledby="completion-heading" className="flex flex-col gap-3">
      <SectionTitle id="completion-heading">Tournament completion</SectionTitle>
      <form action="/admin" className="flex flex-wrap items-end gap-3">
        <Field label="Started from">
          <input type="date" name="from" defaultValue={from} className={`${inputClass} py-2`} />
        </Field>
        <Field label="Started to">
          <input type="date" name="to" defaultValue={to} className={`${inputClass} py-2`} />
        </Field>
        <Button variant="secondary" size="sm" className="mb-1">
          Show
        </Button>
      </form>

      <div className="overflow-x-auto border-2 border-edge bg-plate">
        <table aria-label="Tournament outcomes" className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-[13px] font-semibold tracking-wider text-orange-bright uppercase">Tournaments</th>
              {STATUSES.map((s) => (
                <th key={s.key} className={headerCell}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ label, counts }) => (
              <tr key={label} className="border-t border-edge">
                <th scope="row" className="px-3 py-2 text-left font-semibold">
                  {label} ({counts.total})
                </th>
                {STATUSES.map((s) => (
                  <td key={s.key} className={cell} title={`${counts[s.key]} of ${counts.total}`}>
                    {share(counts[s.key], counts.total)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle as="h3">Where unfinished tournaments stopped</SectionTitle>
      {completion.stoppedAt.length > 0 ? (
        <div className="overflow-x-auto border-2 border-edge bg-plate">
          <table aria-label="Where unfinished tournaments stopped" className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-[13px] font-semibold tracking-wider text-orange-bright uppercase">Next match</th>
                <th className={headerCell}>In progress</th>
                <th className={headerCell}>Given up</th>
              </tr>
            </thead>
            <tbody>
              {completion.stoppedAt.map((s) => (
                <tr key={s.stage} className="border-t border-edge">
                  <th scope="row" className="px-3 py-2 text-left font-semibold">
                    {s.stage}
                  </th>
                  <td className={cell}>{s.inProgress}</td>
                  <td className={cell}>{s.givenUp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Notice>No unfinished or given-up tournaments.</Notice>
      )}
    </section>
  );
}
