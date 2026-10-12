# 04: Global unrated rankings

**What to build:** Visitors can see a global ranking for each category and an overall ranking, built from every match played, refreshed every 5 minutes. This introduces the pure ranking calculation (test seam 2) and the scheduled ranking refresher.

The calculation is Bradley–Terry as specified in the spec's "Ranking algorithm" section (phantom prior of one win and one loss, 30-day half-life for global rankings, Elo-like display scale, score = rating minus range), using sparse pair counts. The prototype `rankings/PROTOTYPE-global-ranking-algorithms.html` is the behavioral reference.

**Blocked by:** 03 (Play an unrated tournament while signed out), so there are matches to rank.

**Status:** done

- [x] The ranking calculation takes a list of matches plus options (half-life or none, current time) and returns rating, ± range, score, wins, losses, and match count per contestant, plus a "not yet judged" list
- [x] A match in a category feeds that category's ranking and the overall ranking; a match drawn from all contestants feeds only the overall ranking
- [x] A scheduled job (Supabase pg_cron calling an Edge Function) recomputes every global ranking every 5 minutes and stores the ready-made lists
- [x] Ranking pages exist for each category and for overall, showing each contestant's picture, name, and score, ordered by score
- [x] Contestants with no matches are listed separately as "not yet judged"
- [x] Ranking calculation tests (seam 2) cover: a strong newcomer rising without jumping to #1 on two lucky wins; strength of opponents beating raw win rate across a strong and weak category; fading following a change in taste; no fading keeping old matches; "not yet judged"; score ordering

## Comments

Done in 6c87983. The pure calculation `calculateRanking` in `rankings/src/domain/ranking/` fits Bradley–Terry with minorization–maximization over sparse pair counts (a map keyed by contestant pair, not a dense matrix). It iterates until converged (max 500 iterations) rather than the prototype's fixed 40, and ignores matches involving contestants outside the scope. The ranking refresher `refreshGlobalRankings` in `src/server/rankings.ts` reads all non-excluded matches, computes the Overall Ranking and each Category Ranking with a 30-day half-life, and stores one list per scope through `store_ranking_list`. That function is service-role only and atomically inserts the new list and drops older ones (tables `ranking_lists` and `ranking_entries`). Pages: `/rankings` (linked from the home page as "See rankings"), `/rankings/overall` and `/rankings/categories/[id]`.

Deviations:
- **Scheduling:** the refresher is a Next.js route handler, `POST /api/rankings/refresh`, protected by the bearer secret `RANKINGS_REFRESH_SECRET`, not an Edge Function. pg_cron plus pg_net calls it every 5 minutes, reading the URL and secret from Vault (`rankings_refresh_url`, `rankings_refresh_secret`); the job does nothing until both are set. I checked the full pg_cron → pg_net → app path locally (HTTP 200). Setup steps are in `rankings/docs/ops.md`.
- **Unrated only:** lists carry a `rated` flag, but only unrated lists are computed. Rated lists come with ticket 13.
- **Score display:** ranking pages show Score rounded to a whole number plus the win–loss record.
- **New env var:** `npm run db:start` now writes a random local `RANKINGS_REFRESH_SECRET`, and Playwright loads `.env.local` so the browser test can call the refresher.
