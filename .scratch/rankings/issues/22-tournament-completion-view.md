# 22: Tournament completion view

**What to build:** The admin page shows how often tournaments get finished, so the owner can tell whether players abandon brackets at painful matchups.

**Blocked by:** 10 (Unfinished tournaments: one rated at a time, Give Up, and resuming), 17 (Reports and catalog moderation).

**Status:** done

- [x] The admin page shows the share of tournaments finished, given up, and still in progress, overall and split by rated and unrated
- [x] It shows, by round, where unfinished and given-up tournaments stopped
- [x] It can be filtered to a date range

## Comments

Done in the `feat(rankings): ticket 22 tournament completion view` commit.

- **Service**: `getTournamentCompletion(db, player, { from, to })` in `src/server/admin.ts`, admin only. Migration `tournament_completion` adds the service-role-only `tournament_completion(from, to)` SQL function, which counts tournaments started in the New York date range (inclusive, either end open) by rated, status, size, and matches played. The service turns those into counts (total, finished, given up, in progress, removed) for all, rated, and unrated tournaments, and works out each unfinished or given-up tournament's stopping stage from its size and matches played.
- **Stage**: the pure `stageOfMatch(size, index)` (`src/domain/tournament/stage.ts`) names the match at a position in play order: "Round of 32", "Round of 16", "Quarterfinals", "Semifinals", "Third-place match", "Final", following `playBracket`'s order (real first-round matches only, third-place match just before the final). Rounds are named from the final, so different sizes line up.
- **UI**: a "Tournament completion" section at the bottom of `/admin`, with "Started from" / "Started to" date inputs (`?from=&to=`), a table of shares (count on hover) for All, Rated, and Unrated, and a table of where unfinished tournaments stopped (next match, in progress, given up), first round first.
- **Tests**: 5 unit tests in `src/domain/tournament/stage.test.ts`; 2 service tests in `tests/service/tournament-completion.test.ts` (counts, stages, and the date filter, on tournaments moved to an unused past day; admin only); 1 browser test in `e2e/moderation.spec.ts`.
- **Deviations**:
  - Removed tournaments (a contestant or category was deleted, or a merge) get their own column, so the shares add up to 100%. They aren't in the stopping-stage table.
  - The date range filters by start date, not finish date. A tournament started before the range and finished in it isn't counted.
  - "Where it stopped" is the stage of the next match to play, so an unplayed tournament counts at its first round.
  - Signed-out tournaments count as unrated. A deleted account's tournaments are deleted with it, so they drop out of the counts.
  - Submitting the date form clears a merge being reviewed, and the other way round (separate GET forms).
