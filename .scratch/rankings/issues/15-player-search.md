# 15: Player search

**What to build:** Anyone can search for players by display name and open their profile.

**Blocked by:** 05 (Google sign-in and display name).

**Status:** done

- [x] A search box finds players by display name (case-insensitive, matching from the start of the name)
- [x] Results link to each player's profile
- [x] Banned and deleted players don't appear in results (once those exist)
- [x] Works signed in or out

## Comments

Done in the `feat(rankings): ticket 15 player search` commit.

- **Service**: `searchPlayers(db, query)` in `src/server/profiles.ts` returns up to 20 players (`SEARCH_RESULTS_SHOWN`) whose display name starts with the query, ignoring case, in display-name order. It reads only the public player columns, so it runs through the visitor client. Banned players and the deleted-player tombstone are left out. `_` is matched as a letter, not a LIKE wildcard. A query with characters that can't be in a display name returns nothing without hitting the database.
- **UI**: `/players?q=…` has a search box (`next/form`, so it's a plain GET that works without JavaScript) and links each result to its profile. The header has a "Players" link for everyone.
- **Tests**: 2 service tests in `tests/service/profiles.test.ts` (prefix and case, literal underscore, empty and invalid queries, through a signed-out client; banned and deleted players left out). 1 browser test in `e2e/account.spec.ts` (signed out: header link, search, open profile).
- **Deviations**:
  - The search doesn't paginate. Past 20 matches, the player has to type more of the name.
  - An exact display name of a banned player isn't found either, though their profile stays public at its address.
