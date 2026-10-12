# 16: Contestant page

**What to build:** Each contestant has a page showing how it's doing everywhere: its score in each category it belongs to and overall, its record, head-to-head results, and how its rating has changed over time.

**Blocked by:** 13 (Rated and unrated rankings).

**Status:** done

- [x] The page shows the contestant's picture, name, and "Added by …" link
- [x] It lists the contestant's score and rank in each of its categories and in overall, with rating ± range, respecting the Rated / Unrated switch
- [x] It shows the overall win-loss record and match count
- [x] It shows head-to-head records against its most frequent opponents
- [x] The refresher stores weekly rating snapshots for rated global rankings, and the page draws a rating-over-time chart from them
- [x] Contestants appear as "not yet judged" in scopes where they have no matches

## Comments

Done in 8cc6ffc.

- `getContestantStanding(db, contestantId, { rated })` in `src/server/rankings.ts` gives the contestant's entry in the latest stored Overall Ranking and each of its Category Rankings (null means not yet judged), its record, its 5 most frequent opponents (`HEAD_TO_HEAD_SHOWN`), and each scope's weekly rating history. Record and head-to-head come from the new `contestant_head_to_head` SQL function.
- Snapshots: migration `20261012005305_contestant_page.sql` adds `rating_snapshots` (one per scope per week, `unique nulls not distinct (category_id, week)`) and `rating_snapshot_entries` (`real` rating and range, one per judged contestant), plus the service-role-only `store_rating_snapshot`. `refreshGlobalRankings` snapshots each rated list that has judged contestants on the week's first refresh. Weeks run Monday to Sunday in New York (`snapshotWeek`, `src/domain/ranking/snapshot-week.ts`). Unrated lists are never snapshotted.
- Page `/contestants/[id]`: picture, name, Added by, the Rated/Unrated switch (`?version=unrated`), Record, Standings (rank, Score, rating ± range, W–L, and an inline SVG chart per scope), and Head-to-head linking to opponents. Edit and delete stay as they were.
- Tests: unit tests for week boundaries; 7 service tests in `tests/service/contestant-page.test.ts`; one browser test in `e2e/contestant.spec.ts`.
- Deviations:
  - Record and head-to-head are counted live from matches (unfaded, non-excluded, rated only in the Rated version), not from the 5-minute stored lists, so they can be a few minutes ahead of the standings.
  - There's a chart for each scope, not only Overall. The chart always shows rated ratings (that's all that's snapshotted), even when the switch is on Unrated.
  - The partial rated-only indexes on `matches.winner_id`/`loser_id` became full indexes, because head-to-head reads unrated matches too. That makes each match row slightly bigger.
  - Snapshots are never pruned (about 52 a year per scope, one small row per judged contestant). The categories list from ticket 06 is now the Standings list.
