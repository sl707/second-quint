# 08: Unrated Infinite Mode

**What to build:** Players (signed in or out) pick a scope and get an endless stream of matches, with pairs chosen to be informative but not scripted. Every pick is stored as an unrated match, and players can skip pairs freely.

**Blocked by:** 03 (Play an unrated tournament while signed out), 04 (Global unrated rankings), since pairing uses the latest ratings.

**Status:** ready-for-agent

- [ ] Players can start Infinite Mode on any scope with at least 2 contestants
- [ ] Pairing (from the prototype): the first contestant is weighted by `1 + 3 / (1 + matches)`; the second by the same boost × `(exp(−k × |rating difference|) + 0.1)`, using the scope's latest global ratings; `k` is tuned so pairs feel varied
- [ ] Each pick is stored immediately as an unrated match in that scope
- [ ] Skip passes on a pair without recording a match; skips are unlimited here
- [ ] Phone layout stacks the two contestants; desktop shows them side by side
- [ ] Game service tests cover that picks are stored in the right scope and that skips record nothing
- [ ] A browser test plays several Infinite Mode picks and a skip at a phone viewport
