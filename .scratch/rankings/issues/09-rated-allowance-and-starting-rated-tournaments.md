# 09: Rated allowance and starting rated tournaments

**What to build:** Signed-in players get a daily rated allowance per scope, and tournaments become rated when the rules allow. Before starting, the player is told whether the tournament will be rated and, if not, why. A rated tournament reserves all its matches up front.

**Blocked by:** 03 (Play an unrated tournament while signed out), 05 (Google sign-in and display name).

**Status:** done

- [x] Rated allowance per account, per scope, per day = number of contestants currently in the scope, minimum 20, maximum 500 for the all-contestants scope
- [x] Days reset at midnight `America/New_York`; the player sees remaining allowance per scope and a countdown to the reset
- [x] A tournament is rated only if the player is signed in, hasn't chosen unrated, the contestants were randomly drawn, the player has no other unfinished rated tournament, and all N matches fit in the remaining allowance
- [x] Before starting, the player sees "rated" or "unrated" and the reason when unrated
- [x] Signed-in players can switch a tournament to unrated before starting (off by default); signed-out visitors are always unrated
- [x] Starting a rated tournament reserves all N matches against that day's allowance immediately
- [x] Each match in a rated tournament is stored as rated the moment it's picked
- [x] Game service tests cover the allowance formula (minimum and cap), the midnight Eastern reset, every reason a tournament is unrated, and up-front reservation

## Comments

Done in d17945f.

- Pure rules in `src/domain/allowance/`: `ratedAllowance`, `allowanceDay` / `nextAllowanceReset` (New York, unit-tested across both DST changes), and `tournamentRatedStatus` + `unratedReasonMessage`, which the start page also uses for the live rated/unrated preview.
- Enforcement is the `start_tournament` SQL function: it locks the player row, checks for an unfinished rated tournament, and adds N to `allowance_use` (player, scope with null = all contestants, day, `used`) only if it fits, all in one transaction. A partial unique index also allows only one unfinished rated tournament per player. Infinite Mode (ticket 12) can add 1 to the same row per rated pick.
- Deviations:
  - The hand-picked reason is covered by unit tests only. Hand-picking doesn't exist until ticket 11, so the service can't be driven into that case yet; ticket 11 should add the service test (pass `p_try_rated = false`).
  - New `expectRated` option: the start form sends what the player was told. If that no longer holds (another tab, midnight), the service starts nothing and the page shows why. A form that said "unrated" always starts unrated, so it never spends allowance the player didn't expect to spend.
  - `startTournament` and `getAllowanceStatus` take an optional `now`, so service tests can cross midnight.
