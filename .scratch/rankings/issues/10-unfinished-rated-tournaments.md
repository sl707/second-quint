# 10: Unfinished tournaments: one rated at a time, Give Up, and resuming

**What to build:** Signed-in players can leave and resume tournaments on any device and on later days. Only one rated tournament can be unfinished at a time, and Give Up ends one. Reserved allowance is never returned. A banner reminds players of unfinished tournaments.

**Blocked by:** 09 (Rated allowance and starting rated tournaments).

**Status:** done

- [x] Signed-in players' unfinished tournaments (rated and unrated) resume on any device
- [x] A rated tournament never expires; matches played after the start day stay rated and don't use the new day's allowance
- [x] Allowance reserved for matches never played is never returned
- [x] A player can't start a rated tournament while another rated tournament is unfinished, in any scope; unrated tournaments and Infinite Mode are never blocked
- [x] Give Up ends an unfinished rated tournament: played matches stay counted, it gets no tournament ranking, nothing is refunded, and the player can start another rated tournament
- [x] A banner on the home page and the player's profile lists unfinished tournaments with a resume link
- [x] Game service tests cover resuming across days without touching the new day's allowance, no refunds, the one-at-a-time rule, and Give Up

## Comments

Done in e1e923c.

- Most of the one-at-a-time rule, up-front reservation, and resuming already came with tickets 03 and 09 (`start_tournament`, the partial unique index, picks never touching `allowance_use`). This ticket adds service tests for them (resuming on a later day, no refunds, unrated never blocked) and `giveUpTournament` in `src/server/game.ts`.
- Give Up only applies to the owner's unfinished rated tournament; an unrated one throws a `GameError`, since it never blocks anything. `pickWinner` and `undoLastPick` now update only unfinished tournaments, so a pick or undo racing a Give Up can't bring it back. A pick that lands mid-race still counts as played, which matches "played matches stay counted".
- The tournament page has a "Give up" disclosure that explains the consequences before the confirm button. A given-up tournament shows "Given up", with no match to pick and no ranking.
- Banner: `UnfinishedTournaments` (rated/unrated label, matches left, resume link) on the home page (for players and signed-out visitors), the start page, and the profile. The profile shows it only to its owner, because unfinished tournaments are private.
- The unrated-reason text now says "Finish it or give it up to start another rated one."
- Infinite Mode doesn't exist yet. Ticket 12 must not check for an unfinished rated tournament.

