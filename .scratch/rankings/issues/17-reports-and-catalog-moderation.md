# 17: Reports and catalog moderation

**What to build:** Anyone can report a contestant, category, or profile. The admin gets an admin page with a report queue and can edit or delete any contestant or category, and remove contestants from categories, with the agreed effects on rankings.

**Blocked by:** 06 (Add contestants and categories).

**Status:** ready-for-agent

- [ ] Contestant, category, and profile pages have a Report action with a short reason
- [ ] An admin-only page lists open reports with links to the reported item, and lets the admin resolve or dismiss each
- [ ] The admin can edit or delete any contestant or category regardless of creator rules
- [ ] The admin can remove a contestant from a category; it leaves that category's rankings, but its matches still count toward overall
- [ ] Deleting a category removes its rankings; its matches still count toward overall
- [ ] Admin-only operations are enforced on the server and by database policies, not just hidden in the UI
- [ ] Game service tests cover report creation, admin-only enforcement, and the ranking effects of removal and category deletion
