# 04: Global unrated rankings

**What to build:** Visitors can see a global ranking for each category and an overall ranking, built from every match played, refreshed every 5 minutes. This introduces the pure ranking calculation (test seam 2) and the scheduled ranking refresher.

The calculation is Bradley–Terry as specified in the spec's "Ranking algorithm" section (phantom prior of one win and one loss, 30-day half-life for global rankings, Elo-like display scale, score = rating minus range), using sparse pair counts. The prototype `rankings/PROTOTYPE-global-ranking-algorithms.html` is the behavioral reference.

**Blocked by:** 03 (Play an unrated tournament while signed out), so there are matches to rank.

**Status:** ready-for-agent

- [ ] The ranking calculation takes a list of matches plus options (half-life or none, current time) and returns rating, ± range, score, wins, losses, and match count per contestant, plus a "not yet judged" list
- [ ] A match in a category feeds that category's ranking and the overall ranking; a match drawn from all contestants feeds only the overall ranking
- [ ] A scheduled job (Supabase pg_cron calling an Edge Function) recomputes every global ranking every 5 minutes and stores the ready-made lists
- [ ] Ranking pages exist for each category and for overall, showing each contestant's picture, name, and score, ordered by score
- [ ] Contestants with no matches are listed separately as "not yet judged"
- [ ] Ranking calculation tests (seam 2) cover: a strong newcomer rising without jumping to #1 on two lucky wins; strength of opponents beating raw win rate across a strong and weak category; fading following a change in taste; no fading keeping old matches; "not yet judged"; score ordering
