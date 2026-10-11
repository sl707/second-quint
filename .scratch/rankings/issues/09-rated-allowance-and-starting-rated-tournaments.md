# 09: Rated allowance and starting rated tournaments

**What to build:** Signed-in players get a daily rated allowance per scope, and tournaments become rated when the rules allow. Before starting, the player is told whether the tournament will be rated and, if not, why. A rated tournament reserves all its matches up front.

**Blocked by:** 03 (Play an unrated tournament while signed out), 05 (Google sign-in and display name).

**Status:** ready-for-agent

- [ ] Rated allowance per account, per scope, per day = number of contestants currently in the scope, minimum 20, maximum 500 for the all-contestants scope
- [ ] Days reset at midnight `America/New_York`; the player sees remaining allowance per scope and a countdown to the reset
- [ ] A tournament is rated only if the player is signed in, hasn't chosen unrated, the contestants were randomly drawn, the player has no other unfinished rated tournament, and all N matches fit in the remaining allowance
- [ ] Before starting, the player sees "rated" or "unrated" and the reason when unrated
- [ ] Signed-in players can switch a tournament to unrated before starting (off by default); signed-out visitors are always unrated
- [ ] Starting a rated tournament reserves all N matches against that day's allowance immediately
- [ ] Each match in a rated tournament is stored as rated the moment it's picked
- [ ] Game service tests cover the allowance formula (minimum and cap), the midnight Eastern reset, every reason a tournament is unrated, and up-front reservation
