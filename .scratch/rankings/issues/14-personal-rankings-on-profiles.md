# 14: Personal rankings on profiles

**What to build:** Every player gets personal rankings built purely from their own matches: per category and overall, rated and unrated, updating instantly. Profiles show personal rankings and past tournaments to anyone.

**Blocked by:** 05 (Google sign-in and display name), 13 (Rated and unrated rankings).

**Status:** ready-for-agent

- [ ] Personal rankings are computed with the same ranking calculation, using only that player's matches and no fading
- [ ] Personal rankings exist for each category the player has played and for overall, each in rated and unrated versions
- [ ] They update immediately after the player's next match (computed on request, not by the 5-minute refresher)
- [ ] Contestants the player hasn't judged are listed separately as "not yet judged", never filled in from global ratings
- [ ] A profile shows the player's personal rankings (Rated by default, with the switch) and past tournaments: finished ones with their tournament ranking, unfinished ones as "in progress"
- [ ] Profiles are viewable by anyone, signed in or not
- [ ] Ranking calculation and game service tests cover that personal rankings include only that player's matches and don't fade
