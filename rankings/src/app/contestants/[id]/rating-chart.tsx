import type { RatingSnapshot } from "@/server/rankings";

const WIDTH = 320;
const HEIGHT = 120;
const PAD_X = 6;
const PAD_Y = 10;
const DAY = 24 * 60 * 60 * 1000;

function weekLabel(week: string) {
  return new Date(`${week}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Weekly rated rating as a line, with its ± range as a shaded band. */
export function RatingChart({ history, scopeName }: { history: RatingSnapshot[]; scopeName: string }) {
  const times = history.map((h) => new Date(`${h.week}T00:00:00Z`).getTime());
  const first = times[0];
  const span = Math.max(times[times.length - 1] - first, 7 * DAY);
  const low = Math.min(...history.map((h) => h.rating - h.range));
  const high = Math.max(...history.map((h) => h.rating + h.range));
  const pad = Math.max((high - low) * 0.05, 1);
  const [yMin, yMax] = [low - pad, high + pad];

  const x = (i: number) =>
    history.length === 1 ? WIDTH / 2 : PAD_X + ((times[i] - first) / span) * (WIDTH - 2 * PAD_X);
  const y = (rating: number) => PAD_Y + ((yMax - rating) / (yMax - yMin)) * (HEIGHT - 2 * PAD_Y);
  const point = (i: number, rating: number) => `${x(i).toFixed(1)},${y(rating).toFixed(1)}`;

  const band = [
    ...history.map((h, i) => point(i, h.rating + h.range)),
    ...history.map((h, i) => point(i, h.rating - h.range)).reverse(),
  ].join(" ");
  const line = history.map((h, i) => point(i, h.rating)).join(" ");
  const latest = history[history.length - 1];

  return (
    <figure className="flex flex-col gap-1">
      <svg
        role="img"
        aria-label={`Rating over time in ${scopeName}: ${history.length} weekly ${history.length === 1 ? "snapshot" : "snapshots"}, latest ${Math.round(latest.rating)}`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full border border-edge bg-ink"
      >
        {history.length > 1 && <polygon points={band} className="fill-pink/25" />}
        {history.length > 1 && <polyline points={line} fill="none" className="stroke-orange" strokeWidth={2} />}
        {history.map((h, i) => (
          <g key={h.week}>
            <line x1={x(i)} x2={x(i)} y1={y(h.rating + h.range)} y2={y(h.rating - h.range)} className="stroke-pink" strokeWidth={2} />
            <circle cx={x(i)} cy={y(h.rating)} r={3} className="fill-orange" />
          </g>
        ))}
      </svg>
      <figcaption className="flex justify-between gap-2 text-xs text-muted">
        <span>Week of {weekLabel(history[0].week)}</span>
        <span>Rated rating, weekly</span>
        {history.length > 1 && <span>{weekLabel(latest.week)}</span>}
      </figcaption>
    </figure>
  );
}
