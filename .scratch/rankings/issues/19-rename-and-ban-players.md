# 19: Rename and ban players

**What to build:** The admin can rename a player's display name and ban a player, optionally removing all their matches from rankings.

**Blocked by:** 14 (Personal rankings on profiles), 17 (Reports and catalog moderation).

**Status:** done

- [x] The admin can change any player's display name (still unique, 3–24 characters)
- [x] The admin can ban a player; banned players can't play, add to the catalog, or report
- [x] When banning, the admin can choose to remove the player's matches from all rankings; matches are flagged as excluded, not deleted, so unbanning can restore them
- [x] Rankings reflect exclusions at the next refresh
- [x] Game service tests cover banned players being blocked and excluded matches leaving every ranking

## Comments

Done in 09c0ac6.

- **Admin service** (`src/server/admin.ts`): `renamePlayer` (same rules as choosing a display name: trimmed, 3–24 letters/digits/`_`/`-`, unique ignoring case; returns the stored name), `banPlayer(…, { removeMatches })`, `unbanPlayer`, and `getBanStatus` (banned, and whether any of their matches are excluded; null for non-admins). Migration `ban_players` adds the service-role-only `set_player_ban(player, banned, exclude_matches)` SQL function, which sets the flag and flips `matches.excluded` on all the player's matches in one transaction.
- **Enforcement**: the game service refuses a banned player in `startTournament`, `pickWinner`, `undoLastPick`, `getInfinitePair`, `pickInfiniteWinner`, and `skipInfinitePair` (new exported `isBanned`); `reportItem` refuses them; the catalog and admin services already did. The tournament page hides the pick, undo, and give-up controls from a banned player and says why; the start and Infinite Mode pages show the game service's message.
- **Rankings**: the refresher, personal rankings, and the contestant record and head-to-head already skip excluded matches, so global rankings change at the next refresh and personal and contestant-page numbers change at once.
- **UI**: on `/players/[name]` the admin (not on their own profile) gets a Display name / Rename form (lands on the new profile address) and Ban with an "Also remove their matches from all rankings" checkbox; once banned it says so (and whether matches are removed) with an Unban button.
- **Tests**: 6 service tests in `tests/service/player-moderation.test.ts` (rename and its rules; banned players blocked from tournaments, Infinite Mode, catalog, and reports; matches kept without removal; removed matches leaving global category and overall, rated and unrated, personal, and contestant rankings after a refresh and coming back after unbanning; admin only, no self-ban); one browser test in `e2e/moderation.spec.ts`.
- **Deviations**:
  - Unbanning always restores the player's matches, and banning an already-banned player again with or without removal sets their matches to match (the UI only offers Unban once banned). `matches.excluded` is only ever set by bans.
  - A banned player can still sign out and play or report as a signed-out visitor (unrated, not tied to their account); nothing stops that.
  - A banned player's unfinished tournaments stay in progress, and their tournament rankings on the profile still show; excluded matches only leave the global, personal, and contestant-page rankings.
  - The admin can't ban themselves. Banned players' profiles stay public, with no public "banned" label.
  - The ban check is in the services, not inside the SQL play functions, so a pick racing the ban by milliseconds could still land (and, if matches were removed, stay counted until the admin bans again).
