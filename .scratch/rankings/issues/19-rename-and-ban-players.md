# 19: Rename and ban players

**What to build:** The admin can rename a player's display name and ban a player, optionally removing all their matches from rankings.

**Blocked by:** 14 (Personal rankings on profiles), 17 (Reports and catalog moderation).

**Status:** ready-for-agent

- [ ] The admin can change any player's display name (still unique, 3–24 characters)
- [ ] The admin can ban a player; banned players can't play, add to the catalog, or report
- [ ] When banning, the admin can choose to remove the player's matches from all rankings; matches are flagged as excluded, not deleted, so unbanning can restore them
- [ ] Rankings reflect exclusions at the next refresh
- [ ] Game service tests cover banned players being blocked and excluded matches leaving every ranking
