# 03: Play an unrated tournament while signed out

**What to build:** The core loop. A signed-out visitor picks a scope (a category or all contestants) and a size, plays a single-elimination tournament by picking winners, and sees a tournament ranking at the end. Every match is stored as an unrated match. This establishes the game service (test seam 1) and the phone-first play screen.

Includes sample contestants and categories (with pictures) for local development, since adding contestants comes later.

**Blocked by:** 01 (Working skeleton).

**Status:** ready-for-agent

- [ ] Visitors can choose a scope; a tournament needs a scope of at least 4 contestants
- [ ] Size can be anything from 4 to the scope's contestant count, defaulting to 16 (or the scope size if smaller)
- [ ] Contestants are drawn at random and placed randomly; byes fill the bracket up to the next power of two, each bye paired with a real contestant in round one
- [ ] A third-place match is played between the semifinal losers when both exist; a tournament of N contestants has exactly N matches
- [ ] The whole bracket is always viewable during play, with a "matches left" counter
- [ ] The visitor can undo their most recent pick until they pick the next match; the undone match is removed
- [ ] Finishing shows the tournament ranking: 1st, 2nd, 3rd, 4th, then tied tiers by round of elimination
- [ ] Each pick is stored immediately as a match (winner, loser, scope, anonymous visitor ID, unrated, tournament, round, time)
- [ ] An unfinished tournament resumes in the same browser after closing the tab
- [ ] Phone layout stacks the two contestants; desktop shows them side by side
- [ ] Game service tests cover draw sizes, byes, third-place match, match count, undo rules, and tournament ranking tiers
- [ ] A browser test plays a full tournament at a phone viewport to its tournament ranking
