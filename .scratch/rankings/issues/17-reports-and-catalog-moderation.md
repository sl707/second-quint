# 17: Reports and catalog moderation

**What to build:** Anyone can report a contestant, category, or profile. The admin gets an admin page with a report queue and can edit or delete any contestant or category, and remove contestants from categories, with the agreed effects on rankings.

**Blocked by:** 06 (Add contestants and categories).

**Status:** done

- [x] Contestant, category, and profile pages have a Report action with a short reason
- [x] An admin-only page lists open reports with links to the reported item, and lets the admin resolve or dismiss each
- [x] The admin can edit or delete any contestant or category regardless of creator rules
- [x] The admin can remove a contestant from a category; it leaves that category's rankings, but its matches still count toward overall
- [x] Deleting a category removes its rankings; its matches still count toward overall
- [x] Admin-only operations are enforced on the server and by database policies, not just hidden in the UI
- [x] Game service tests cover report creation, admin-only enforcement, and the ranking effects of removal and category deletion

## Comments

Done in d04cecb.

- **Reports**: migration `reports_and_moderation` adds `reports` (player or signed-out visitor reporter, target type and ID, reason up to 280 characters, status open/resolved/dismissed). `reportItem` in the catalog service; a `Report` form (short reason) on contestant, category, and profile pages (not on your own profile). Anyone can report, signed in or not; reporting the same thing again while your report is open adds nothing.
- **Admin**: new admin service `src/server/admin.ts` (`isAdmin`, `listOpenReports`, `closeReport`, `removeContestantFromCategory`, `deleteCategory`). `/admin` lists open reports oldest first (up to 200) with links, Resolve and Dismiss; it 404s for everyone else, and the header shows an Admin link to the admin. The category page shows Remove buttons and Delete category to the admin. Admin editing and deleting of any contestant or category already worked through the catalog service.
- **Enforcement**: every admin function checks `is_admin` (and not banned) on the server. In the database, only the admin can read `reports` (row-level security through `private.is_admin()`); nobody can write reports from the browser; `remove_from_category`, `delete_category`, and `delete_contestant` are service-role only.
- **Ranking effects**: removing a contestant from a category drops it from that category's stored lists right away (positions renumbered) and clears it as cover; refreshes leave its matches out of the category ranking while they still count toward overall. Deleting a category cascades its rankings and snapshots; its matches become all-contestants matches (overall only).
- **Coordinator change to ticket 06**: deleting a contestant now deletes only its own matches. Tournaments that drew it get the new status `removed` (can't continue or be undone, no tournament ranking, shown as "Removed"); their other matches still count. Ticket 06's comment and test were updated to match.
- **Tests**: 8 service tests in `tests/service/moderation.test.ts` (report creation and validation, admin-only queue, browser-side RLS checks with a real signed-in client, removal, category deletion, and admin contestant deletion); the ticket 06 delete test was rewritten; one browser test `e2e/moderation.spec.ts`.
- **Deviations**:
  - Deleting a category also ends its unfinished tournaments as `removed`, and resolves open reports about it (deleting a contestant does the same). Finished tournaments of a deleted category stay finished but show as "All contestants" on profiles, since their category link is cleared.
  - When a contestant is removed from a category, other members' category ratings also lose their matches against it, from the next refresh. Unfinished tournaments in that category can still be finished.
  - Reports about deleted players or items show "Deleted" in the queue. The queue has no history view of closed reports.

Code review follow-up (2026-10-11): accepted deviation on "enforced on the server and by database policies". Policies only govern reads (only the admin can read `reports`). Browser roles have no write policies at all, and admin-only SQL functions are service-role only. So writes are enforced in the server's services rather than by per-role write policies; see ticket 03.
