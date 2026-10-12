# 03: Play an unrated tournament while signed out

**What to build:** The core loop. A signed-out visitor picks a scope (a category or all contestants) and a size, plays a single-elimination tournament by picking winners, and sees a tournament ranking at the end. Every match is stored as an unrated match. This establishes the game service (test seam 1) and the phone-first play screen.

Includes sample contestants and categories (with pictures) for local development, since adding contestants comes later.

**Blocked by:** 01 (Working skeleton).

**Status:** done

- [x] Visitors can choose a scope; a tournament needs a scope of at least 4 contestants
- [x] Size can be anything from 4 to the scope's contestant count, defaulting to 16 (or the scope size if smaller)
- [x] Contestants are drawn at random and placed randomly; byes fill the bracket up to the next power of two, each bye paired with a real contestant in round one
- [x] A third-place match is played between the semifinal losers when both exist; a tournament of N contestants has exactly N matches
- [x] The whole bracket is always viewable during play, with a "matches left" counter
- [x] The visitor can undo their most recent pick until they pick the next match; the undone match is removed
- [x] Finishing shows the tournament ranking: 1st, 2nd, 3rd, 4th, then tied tiers by round of elimination
- [x] Each pick is stored immediately as a match (winner, loser, scope, anonymous visitor ID, unrated, tournament, round, time)
- [x] An unfinished tournament resumes in the same browser after closing the tab
- [x] Phone layout stacks the two contestants; desktop shows them side by side
- [x] Game service tests cover draw sizes, byes, third-place match, match count, undo rules, and tournament ranking tiers
- [x] A browser test plays a full tournament at a phone viewport to its tournament ranking

## Comments

Done in eb5d692. Game service in `rankings/src/server/game.ts` (start, pick, undo, list unfinished) over new tables (contestants, categories, category_memberships, tournaments, matches) with public read and anonymous visitor IDs hidden by column grants; bracket rules are pure in `src/domain/tournament/`. Pages: `/tournaments/new` (scope, size, resume list) and `/tournaments/[id]` (current match, bracket, undo, tournament ranking); visitor identity is the httpOnly `sq_visitor` cookie. Deviations: undo is one step (after an undo, nothing more can be undone until the next pick; the final pick can be undone, reopening the tournament); matches gain a `bracket_match` column (position in play order, unique per tournament) to stop double taps recording two picks, and tournaments a `can_undo` flag; the third-place match is stored with the final's round number; sample pictures are generated SVGs rather than WebP; tournament play pages are visible only to the visitor who owns them; `npm run typecheck` now runs `next typegen` first.

Code review follow-up (2026-10-11):

- The final pick can be undone from the finished tournament's page (the Undo button stays until the person's next pick in another tournament). Undoing it is refused with "You can't undo the final pick while another rated tournament is unfinished. Finish or give up that one first." instead of failing on the one-unfinished-rated-tournament index.
- Tournament picks now go through the `pick_tournament_match` SQL function (refuses banned players, see ticket 19).
- Accepted deviation from the spec's row-level security line ("players write only their own play and catalog entries"): the database policies are read-only for the browser (`anon`, `authenticated`). Every write, play and catalog alike, goes through the server's services with the service-role client, which enforce who may write what.
