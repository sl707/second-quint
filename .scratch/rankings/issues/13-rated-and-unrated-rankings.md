# 13: Rated and unrated rankings

**What to build:** Every global ranking comes in a rated version (only rated matches) and an unrated version (every match). Ranking pages show the rated version by default with a Rated / Unrated switch.

**Blocked by:** 04 (Global unrated rankings), 09 (Rated allowance and starting rated tournaments).

**Status:** ready-for-agent

- [ ] The refresher computes both versions for every category and for overall
- [ ] Rated rankings use only rated matches; unrated rankings use every match, including Infinite Mode, hand-picked and unfinished tournaments, and signed-out play
- [ ] Ranking pages default to Rated and offer a Rated / Unrated switch
- [ ] Each version has its own "not yet judged" list
- [ ] Game service tests verify which rankings a match feeds: its category's and overall's, in the unrated version always and the rated version only when the match is rated
- [ ] A browser test switches a ranking between Rated and Unrated
