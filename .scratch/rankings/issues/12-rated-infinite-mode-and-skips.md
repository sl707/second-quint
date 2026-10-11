# 12: Rated Infinite Mode and skips

**What to build:** For signed-in players, Infinite Mode picks are rated while they have allowance in that scope, and play continues unrated once it runs out. Skips are limited while playing rated.

**Blocked by:** 08 (Unrated Infinite Mode), 09 (Rated allowance and starting rated tournaments).

**Status:** ready-for-agent

- [ ] A pick is rated if the player is signed in, hasn't chosen unrated, and has allowance left in that scope at that moment; each rated pick uses one allowance
- [ ] When the allowance runs out, Infinite Mode tells the player and continues with unrated picks
- [ ] Signed-in players can choose unrated before starting Infinite Mode
- [ ] While playing rated, players get 5 skips per day across all Infinite Mode, with a visible counter; when they're out, rated pairs must be picked
- [ ] While playing unrated, skips are unlimited
- [ ] Game service tests cover the switch to unrated at zero allowance, the 5-skip limit while rated, and unlimited unrated skips
