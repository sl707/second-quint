# 18: Merge duplicate contestants

**What to build:** The admin can merge two duplicate contestants into one, combining their history so the catalog stays clean without losing anyone's picks.

**Blocked by:** 17 (Reports and catalog moderation).

**Status:** done

- [x] From the admin page, the admin picks a duplicate and a survivor and confirms the merge
- [x] The duplicate's matches and category memberships move to the survivor
- [x] Matches between the two duplicates are dropped
- [x] The duplicate's page redirects to the survivor's page
- [x] Rankings reflect the merge at the next refresh
- [x] Game service tests cover moved matches and memberships, dropped matches between the duplicates, and the redirect

## Comments

Done in a8fe63d.

- **Merge**: migration `merge_contestants` adds the service-role-only `merge_contestants(duplicate, survivor)` SQL function, which does the whole merge in one transaction (both rows locked in ID order). It moves the duplicate's matches, category memberships, category covers, and offered Infinite Mode pairs to the survivor; drops matches (and offered pairs) between the two; puts the survivor in the duplicate's bracket slots; takes the duplicate out of the stored ranking lists at once (positions renumbered); resolves open reports about it; and sets `merged_into` on the duplicate and on anything merged into it earlier. Admin service `mergeContestants` and `previewMerge` (`src/server/admin.ts`); `findMergeSurvivor` (`src/server/catalog.ts`) backs a permanent redirect from the duplicate's page (keeping `?version=unrated`).
- **Admin page**: a "Merge duplicate contestants" section. The admin pastes two contestant links or IDs (duplicate, survivor), clicks Review merge, sees both with pictures, and confirms with "Merge X into Y", which lands on the survivor's page.
- **Tests**: 5 service tests in `tests/service/merge.test.ts` (moved matches and memberships, dropped matches between the two, rankings after refresh, redirect including chains, tournaments, covers/pairs/stored rankings/reports, admin-only and refusals); one browser test added to `e2e/moderation.spec.ts`.
- **Deviations**:
  - Tournaments that drew both contestants end as `removed` (same meaning as in ticket 17: no tournament ranking, can't continue, other matches still count), since their bracket would hold the survivor twice. Finished ones too.
  - The duplicate leaves the stored rankings right away; the survivor's stored entry only takes in the moved matches at the next refresh.
  - The duplicate's row is kept (not deleted). Its weekly rating snapshots stay on it, unseen, rather than being mixed into the survivor's chart.
  - `source_id` moves to the survivor only when the survivor has none; otherwise it stays on the duplicate, and a future importer must follow `merged_into`.
  - No undo: a merge can't be reversed.
