# 12: Rated Infinite Mode and skips

**What to build:** For signed-in players, Infinite Mode picks are rated while they have allowance in that scope, and play continues unrated once it runs out. Skips are limited while playing rated.

**Blocked by:** 08 (Unrated Infinite Mode), 09 (Rated allowance and starting rated tournaments).

**Status:** done

- [x] A pick is rated if the player is signed in, hasn't chosen unrated, and has allowance left in that scope at that moment; each rated pick uses one allowance
- [x] When the allowance runs out, Infinite Mode tells the player and continues with unrated picks
- [x] Signed-in players can choose unrated before starting Infinite Mode
- [x] While playing rated, players get 5 skips per day across all Infinite Mode, with a visible counter; when they're out, rated pairs must be picked
- [x] While playing unrated, skips are unlimited
- [x] Game service tests cover the switch to unrated at zero allowance, the 5-skip limit while rated, and unlimited unrated skips

## Comments

Done in e3311b2.

- SQL functions `pick_infinite_pair` and `skip_infinite_pair` (migration `rated_infinite_mode`) claim the pair, check and add to `allowance_use` / the new `skip_use` (player, day, used), and record the match in one transaction, locking the player's row like `start_tournament`. Service test covers a rated pick racing a rated tournament start for the last allowance.
- A skip counts as rated (limited) exactly when a pick of that pair would be rated: signed in, not chosen unrated, allowance left in the scope. Out of allowance, skips are free. Out of rated skips, the skip is refused and the pair stays offered.
- `getInfinitePair` returns `play`: `{ rated, ratedPicksLeft, ratedSkipsLeft }` or `{ rated: false, reason }` (`signed-out`, `chose-unrated`, `allowance-used-up`). `pickInfiniteWinner`, `skipInfinitePair`, `getInfinitePair` take an optional `now`.
- Deviations:
  - Choosing unrated gives a separate offered pair (`infinite_pairs.chose_unrated`, part of the unique key), so free unrated skips can't be used to clear the rated pair. The choice is a "Play unrated" checkbox on `/infinite` and travels as `?play=unrated`; the play page has a "Play rated" link back.
  - The scope list shows rated picks left per scope. The last rated pick's message says picks are now unrated; the header then explains why.
  - One new e2e walkthrough (signed-in rated play with skip counter, then unrated).

Code review follow-up (2026-10-11): Infinite Mode now shows the midnight Eastern reset countdown to signed-in players too (story 52). `getInfinitePair` returns `allowanceResetsAt`, and the countdown component moved to `src/app/allowance-countdown.tsx`, shared with `/tournaments/new`.
