import type { CompletionCounts, TournamentCompletion } from "@/server/admin";

const STATUSES: { key: keyof Omit<CompletionCounts, "total">; label: string }[] = [
  { key: "finished", label: "Finished" },
  { key: "givenUp", label: "Given up" },
  { key: "inProgress", label: "In progress" },
  { key: "removed", label: "Removed" },
];

const cell = "px-2 py-1.5 text-right tabular-nums";
const headerCell = "px-2 py-1.5 text-right font-medium text-zinc-500";

function share(count: number, total: number) {
  return total ? `${Math.round((count / total) * 100)}%` : "—";
}

/** The admin's view of how often tournaments get finished, started in the chosen date range. */
export function TournamentCompletionView({
  completion,
  from,
  to,
  headingClass,
}: {
  completion: TournamentCompletion;
  from: string;
  to: string;
  headingClass: string;
}) {
  const groups = [
    { label: "All", counts: completion.overall },
    { label: "Rated", counts: completion.rated },
    { label: "Unrated", counts: completion.unrated },
  ];

  return (
    <section aria-labelledby="completion-heading" className="flex flex-col gap-3">
      <h2 id="completion-heading" className={headingClass}>
        Tournament completion
      </h2>
      <form action="/admin" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-600">
          <span>Started from</span>
          <input type="date" name="from" defaultValue={from} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-600">
          <span>Started to</span>
          <input type="date" name="to" defaultValue={to} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900" />
        </label>
        <button type="submit" className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800">
          Show
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table aria-label="Tournament outcomes" className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-zinc-500">Tournaments</th>
              {STATUSES.map((s) => (
                <th key={s.key} className={headerCell}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ label, counts }) => (
              <tr key={label} className="border-t border-zinc-100">
                <th scope="row" className="px-2 py-1.5 text-left font-medium">
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

      <h3 className="text-sm font-medium text-zinc-700">Where unfinished tournaments stopped</h3>
      {completion.stoppedAt.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table aria-label="Where unfinished tournaments stopped" className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-zinc-500">Next match</th>
                <th className={headerCell}>In progress</th>
                <th className={headerCell}>Given up</th>
              </tr>
            </thead>
            <tbody>
              {completion.stoppedAt.map((s) => (
                <tr key={s.stage} className="border-t border-zinc-100">
                  <th scope="row" className="px-2 py-1.5 text-left font-medium">
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
        <p className="text-zinc-600">No unfinished or given-up tournaments.</p>
      )}
    </section>
  );
}
