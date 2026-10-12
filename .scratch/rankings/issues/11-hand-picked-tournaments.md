# 11: Hand-picked tournaments

**What to build:** Players can build a tournament by choosing its contestants themselves from a scope, for settling a specific debate. Hand-picked tournaments are always unrated.

**Blocked by:** 09 (Rated allowance and starting rated tournaments).

**Status:** done

- [x] When starting a tournament, players can choose "pick contestants" instead of a random draw
- [x] Players select at least 4 contestants from the chosen scope; placement in the bracket is still random
- [x] The tournament is shown as unrated before starting, with the reason "hand-picked"
- [x] All its matches are stored as unrated and don't use any allowance
- [x] Game service tests cover that hand-picked tournaments are always unrated, even with allowance available

## Comments

Done in 0e67ec9.

- `startTournament` takes `contestantIds` (deduplicated; at least 4, all from the scope; size = how many were picked) and places them at random with the existing `drawBracket`. New `listScopeContestants` lists a scope's contestants by name.
- Migration `hand_picked_tournaments` replaces `start_tournament` with a `p_hand_picked` parameter: stores `tournaments.hand_picked`, never rates it, never touches `allowance_use`, returns reason `hand-picked`.
- Start page: "Random draw" / "Pick contestants" choice; picking loads the selected scope's contestants through `?pick=<scope>` (server-rendered, so the all-contestants list isn't sent unless asked for), with a name filter and checkboxes. Size and "Play unrated" are hidden while picking.
- Service tests in `tests/service/hand-picked-tournaments.test.ts` (including the hand-picked unrated reason ticket 09 left to unit tests); one e2e.
- Deviation: "hand-picked" now outranks every other unrated reason (including signed-out and chose-unrated) in `tournamentRatedStatus` and the service, so a hand-picked tournament always shows that reason.
