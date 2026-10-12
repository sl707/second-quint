# 13: Rated and unrated rankings

**What to build:** Every global ranking comes in a rated version (only rated matches) and an unrated version (every match). Ranking pages show the rated version by default with a Rated / Unrated switch.

**Blocked by:** 04 (Global unrated rankings), 09 (Rated allowance and starting rated tournaments).

**Status:** done

- [x] The refresher computes both versions for every category and for overall
- [x] Rated rankings use only rated matches; unrated rankings use every match, including Infinite Mode, hand-picked and unfinished tournaments, and signed-out play
- [x] Ranking pages default to Rated and offer a Rated / Unrated switch
- [x] Each version has its own "not yet judged" list
- [x] Game service tests verify which rankings a match feeds: its category's and overall's, in the unrated version always and the rated version only when the match is rated
- [x] A browser test switches a ranking between Rated and Unrated

## Comments

Done in c2593a7.

- `refreshGlobalRankings` stores a rated list (rated matches only) and an unrated list (every counted match) for overall and every category; each list has its own "not yet judged" entries. No migration: `ranking_lists.rated` and `store_ranking_list(p_rated)` already existed.
- `getGlobalRanking(db, categoryId, { rated })` takes the version explicitly. Ranking pages show Rated by default; the switch is two links (`nav` "Ranking version"), and Unrated is `?version=unrated`.
- Service tests in `tests/service/rankings.test.ts` play through the game service: a rated Infinite Mode pick and a pick in an unfinished rated tournament feed both versions of category and overall; a signed-out pick feeds only unrated; a rated all-contestants match feeds only overall. The browser test switches a category ranking from Rated to Unrated.
- Follow-ups from tickets 06 and 08: the default category cover and Infinite Mode pairing now read only the rated list (no fallback to unrated). Until a category has rated matches, its default cover is its first contestant by name.
- Deviation: the refresher now does twice the work per run (two lists per scope).
