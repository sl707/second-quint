# 10: Unfinished tournaments: one rated at a time, Give Up, and resuming

**What to build:** Signed-in players can leave and resume tournaments on any device and on later days. Only one rated tournament can be unfinished at a time, and Give Up ends one. Reserved allowance is never returned. A banner reminds players of unfinished tournaments.

**Blocked by:** 09 (Rated allowance and starting rated tournaments).

**Status:** ready-for-agent

- [ ] Signed-in players' unfinished tournaments (rated and unrated) resume on any device
- [ ] A rated tournament never expires; matches played after the start day stay rated and don't use the new day's allowance
- [ ] Allowance reserved for matches never played is never returned
- [ ] A player can't start a rated tournament while another rated tournament is unfinished, in any scope; unrated tournaments and Infinite Mode are never blocked
- [ ] Give Up ends an unfinished rated tournament: played matches stay counted, it gets no tournament ranking, nothing is refunded, and the player can start another rated tournament
- [ ] A banner on the home page and the player's profile lists unfinished tournaments with a resume link
- [ ] Game service tests cover resuming across days without touching the new day's allowance, no refunds, the one-at-a-time rule, and Give Up
