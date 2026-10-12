# 08: Unrated Infinite Mode

**What to build:** Players (signed in or out) pick a scope and get an endless stream of matches, with pairs chosen to be informative but not scripted. Every pick is stored as an unrated match, and players can skip pairs freely.

**Blocked by:** 03 (Play an unrated tournament while signed out), 04 (Global unrated rankings), since pairing uses the latest ratings.

**Status:** done

- [x] Players can start Infinite Mode on any scope with at least 2 contestants
- [x] Pairing (from the prototype): the first contestant is weighted by `1 + 3 / (1 + matches)`; the second by the same boost × `(exp(−k × |rating difference|) + 0.1)`, using the scope's latest global ratings; `k` is tuned so pairs feel varied
- [x] Each pick is stored immediately as an unrated match in that scope
- [x] Skip passes on a pair without recording a match; skips are unlimited here
- [x] Phone layout stacks the two contestants; desktop shows them side by side
- [x] Game service tests cover that picks are stored in the right scope and that skips record nothing
- [x] A browser test plays several Infinite Mode picks and a skip at a phone viewport

## Comments

Done in 663c221.

- Pure pairing `pickInfinitePair` in `rankings/src/domain/infinite/pairing.ts`, with randomness injected. `k = 0.01` per rating point on the 1500-centered scale (the prototype's `6` was per win-rate unit). In unit tests, about half the pairs are within 100 points and over 8% are more than 300 apart. Contestants the latest list hasn't judged count as rating 1500 with 0 matches.
- Game service (`src/server/game.ts`): `getInfinitePair`, `pickInfiniteWinner`, `skipInfinitePair`. The pair on offer is stored per person and scope in the new `infinite_pairs` table (RLS on, no policies). Reloading shows the same pair, picking or skipping deletes it first, and a double tap records one match. Ticket 12 can add rated picks (`allowance_use`) and the skip counter in those two functions without reworking the flow. Picks are always `rated: false` for now.
- Ratings come from the scope's latest stored list, preferring a rated list when one exists (none until ticket 13), else the unrated one.
- Pages: `/infinite` (scope list; scopes under 2 contestants disabled) and `/infinite/[scope]`. The home page links "Play Infinite Mode". Signed-out visitors get the visitor cookie from the start action.
- Deviations: a "N picks so far" counter and a last-pick message, so play has feedback. Desktop side-by-side isn't browser-tested (the phone test checks stacking). Watch for Next.js memoizing identical GET fetches within one render: the pair re-read uses a fresh `abortSignal`.
