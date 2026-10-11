# 18: Merge duplicate contestants

**What to build:** The admin can merge two duplicate contestants into one, combining their history so the catalog stays clean without losing anyone's picks.

**Blocked by:** 17 (Reports and catalog moderation).

**Status:** ready-for-agent

- [ ] From the admin page, the admin picks a duplicate and a survivor and confirms the merge
- [ ] The duplicate's matches and category memberships move to the survivor
- [ ] Matches between the two duplicates are dropped
- [ ] The duplicate's page redirects to the survivor's page
- [ ] Rankings reflect the merge at the next refresh
- [ ] Game service tests cover moved matches and memberships, dropped matches between the duplicates, and the redirect
