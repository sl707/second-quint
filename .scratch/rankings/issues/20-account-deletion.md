# 20: Account deletion

**What to build:** A player can delete their account. Everything personal disappears; their contributions to the shared catalog and global rankings stay, anonymously.

**Blocked by:** 14 (Personal rankings on profiles).

**Status:** done

- [x] Signed-in players can delete their account after a confirmation step
- [x] Deletion removes the profile, display name, and personal rankings, and signs the player out
- [x] Their matches stay in global rankings, re-pointed to an anonymous placeholder
- [x] Their contestants and categories stay, showing "Added by a deleted player"
- [x] Game service tests cover that global rankings are unchanged by deletion and that nothing personal remains

## Comments

Done in 4b4bd60.

- **Service**: `deleteAccount(db, player)` in `src/server/profiles.ts` calls the service-role-only `delete_player_account` SQL function (migration `account_deletion`), which does the whole database side in one transaction, then deletes the Supabase auth user with the admin API, so the email is gone too. If the auth deletion fails after the database part succeeded, the error is thrown; signing in again would then just ask for a new display name.
- **Tombstone**: one shared `players` row `00000000-0000-0000-0000-000000000000` with no auth user and no display name (a check constraint makes it the only such row). The function re-points the player's matches (keeping `rated` and `excluded`) and their contestants, categories, and category memberships to it; deletes their tournaments and player row (cascading to `allowance_use`, `skip_use`, `infinite_pairs`); their reports lose the reporter; open reports about their profile are resolved. `Contributor` is now `{ id, displayName } | "deleted" | null`, and `AddedBy` shows "Added by a deleted player". `getProfile` never returns the tombstone (404); `renamePlayer` and `set_player_ban` refuse it.
- **UI**: "Delete account" on the player's own profile (in place of the Report form), confirmed by typing their display name (any case); then signed out and sent home.
- **Tests**: 4 service tests in `tests/service/account-deletion.test.ts` (global category rankings unchanged, rated and unrated, after a refresh; nothing personal left: profile, display name freed, auth user, tournaments, personal rankings, allowance, skips, offered pairs, reports; contestants and categories kept with the deleted-player credit and no tombstone profile; deleting twice refused); one browser test in `e2e/account.spec.ts`.
- **Deviations**:
  - Tournaments are personal, so they're deleted; their matches are detached from them first (`tournament_id`, `round`, `bracket_match` cleared) so the matches survive. Reports the player filed stay, anonymous.
  - The admin can delete their own account too, which leaves no admin until one is set in SQL.
  - A banned player can delete their account and sign up again with the same Google account as a new player. Their excluded matches stay excluded.
  - Someone signed in who never chose a display name isn't a player and has no Delete account control; their auth user stays.
  - Player search (ticket 15, not built yet) must leave out the tombstone (it has no display name).

Follow-up fixes:

- **Ban evasion** (fixes the deviation above). When a banned player deletes their account, `delete_player_account` first stores SHA-256 hashes of their sign-in in the new service-role-only `banned_identities` table: their auth user ID, each auth identity (provider and provider user ID, for example their Google account ID), and their lowercased email. `chooseDisplayName` refuses a new auth user who matches any of them with "This account is banned.", and `/welcome` shows that message instead of the display-name form, so they can't become a player again. The hashing runs in the security-definer `private.identity_hashes`, since only the database owner can read Supabase Auth's tables. Players who weren't banned can still come back. Such a ban can't be lifted (see ticket 19's comments). 2 service tests in `tests/service/account-deletion.test.ts`.
- **Last admin** (fixes the "leaves no admin" deviation above). `delete_player_account` refuses to delete the only admin who isn't banned, raising `only_admin` (it locks the admin rows first, so two admins deleting at once can't both succeed). `deleteAccount` turns that into "You're the only admin. Make another player the admin before deleting your account.", which the Delete account form shows after the confirm. Making another admin is still done in SQL. 1 service test in `tests/service/account-deletion.test.ts` (refused while the only admin, a banned second admin doesn't count, allowed once there's another admin).
