# 11: Hand-picked tournaments

**What to build:** Players can build a tournament by choosing its contestants themselves from a scope, for settling a specific debate. Hand-picked tournaments are always unrated.

**Blocked by:** 09 (Rated allowance and starting rated tournaments).

**Status:** ready-for-agent

- [ ] When starting a tournament, players can choose "pick contestants" instead of a random draw
- [ ] Players select at least 4 contestants from the chosen scope; placement in the bracket is still random
- [ ] The tournament is shown as unrated before starting, with the reason "hand-picked"
- [ ] All its matches are stored as unrated and don't use any allowance
- [ ] Game service tests cover that hand-picked tournaments are always unrated, even with allowance available
