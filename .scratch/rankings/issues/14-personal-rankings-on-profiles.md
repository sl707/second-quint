# 14: Personal rankings on profiles

**What to build:** Every player gets personal rankings built purely from their own matches: per category and overall, rated and unrated, updating instantly. Profiles show personal rankings and past tournaments to anyone.

**Blocked by:** 05 (Google sign-in and display name), 13 (Rated and unrated rankings).

**Status:** done

- [x] Personal rankings are computed with the same ranking calculation, using only that player's matches and no fading
- [x] Personal rankings exist for each category the player has played and for overall, each in rated and unrated versions
- [x] They update immediately after the player's next match (computed on request, not by the 5-minute refresher)
- [x] Contestants the player hasn't judged are listed separately as "not yet judged", never filled in from global ratings
- [x] A profile shows the player's personal rankings (Rated by default, with the switch) and past tournaments: finished ones with their tournament ranking, unfinished ones as "in progress"
- [x] Profiles are viewable by anyone, signed in or not
- [x] Ranking calculation and game service tests cover that personal rankings include only that player's matches and don't fade

## Comments

Done in 084b0eb.

- `getPersonalRanking(db, playerId, categoryId, { rated })` in `src/server/rankings.ts` reads the player's non-excluded matches and runs `calculateRanking` with `halfLifeDays: null` on every request; nothing is stored. `listPersonalRankingScopes` gives Overall plus each category the player has a match in. `listPastTournaments` in `src/server/game.ts` replays finished brackets to get their tournament rankings.
- Profile `/players/[name]`: scope chips (`?scope=<category ID>`, Overall by default), the Rated/Unrated switch (`?version=unrated`), the ranking with "Not yet judged", and past tournaments. Finished ones expand to show their tournament ranking; the rest say "In progress" or "Given up". Reads go through the visitor client, since matches and tournaments are already public.
- `RankingList` and `VersionSwitch` were pulled out of `RankingView` so global and personal rankings share them.
- Tests: a unit test (no fading weighs a year-old match like today's); service tests in `tests/service/personal-rankings.test.ts` (only the player's matches, no fading, instant after a game-service pick, rated vs unrated, all-contestants matches feed overall only, excluded matches left out, scopes) and in `profiles.test.ts` (past tournaments, readable by anyone); one browser test.
- Deviations:
  - The profile lists only the latest 50 tournaments (`PAST_TOURNAMENTS_SHOWN`).
  - Given-up tournaments are listed as "Given up", with no ranking.
  - Unfinished tournaments in the public list don't link anywhere (tournament pages stay owner-only). The owner still gets the resume banner.
  - The personal Overall Ranking lists every contestant the player hasn't judged, like the global one. With a big catalog that list gets long, so it may need a cap later.
