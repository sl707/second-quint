# 06: Add contestants and categories

**What to build:** Signed-in players grow the shared catalog: they add contestants with an uploaded picture, create categories, and add contestants to categories. Contributions go live immediately and show who added them.

**Blocked by:** 05 (Google sign-in and display name).

**Status:** done

- [x] Signed-in players can add a contestant with a name and an uploaded picture (JPG, PNG, WebP, or GIF, up to 5 MB)
- [x] The browser shrinks each picture before upload to a center-cropped square WebP at 512 px and 128 px, keeping only the first frame of a GIF
- [x] Pictures are stored in Supabase Storage under content-addressed names with a permanent cache header
- [x] While adding, a similar-name warning ("Did you mean…?") lists existing contestants with similar names (case- and accent-insensitive)
- [x] Signed-in players can create a category with a name and a description (up to 280 characters)
- [x] Signed-in players can add existing contestants to any category
- [x] A category's creator can choose one of its contestants as the cover; with no choice, the cover is its top contestant by score
- [x] Contestants and categories show "Added by …" linking to the creator's profile
- [x] A contestant's creator can edit its name and picture, or delete it, until its first rated match; after that only the admin can
- [x] A category's creator can edit its details until it has 10 contestants; after that only the admin can
- [x] New contestants and categories go live immediately and can be played
- [x] Game service tests cover the edit and delete permission rules for contestants and categories

## Comments

Implemented in 4bcb2f0.

- **Built**: catalog service `src/server/catalog.ts` (add/edit/delete contestant, similar-name lookup, create/edit category, add to category, set cover, list categories, rights for the viewer); pure rules in `src/domain/catalog/permissions.ts` and `src/domain/picture/picture.ts` (accepted types, 5 MB limit, center-square crop, stored-type sniffing; reusable by a `sharp` import); browser resizer `src/lib/picture/resize.ts`. Migration `20261012001943_catalog_contributions.sql`: internal unique nullable `contestants.source_id` (not readable by anon/authenticated), accent/case-insensitive `name_key` with a trigram index and `similar_contestants()`, `delete_contestant()`, partial indexes on rated matches by contestant, and the public `pictures` bucket (so `supabase db push` creates it). Pages: `/categories`, `/categories/new`, `/categories/[id]`, `/contestants/new` (optionally `?category=`), `/contestants/[id]`; home links to categories.
- **Tests**: 13 catalog service tests, 6 picture unit tests, and one phone walkthrough (`e2e/catalog.spec.ts`) that checks the stored files are 512/128 px WebP squares.
- `players.is_admin` already existed (ticket 05).
- **Deviations**:
  - Browsers that can't encode WebP from a canvas (Safari) upload JPEG instead; the bucket accepts `image/webp` and `image/jpeg`.
  - ~~Deleting a contestant also deletes its matches and every tournament whose bracket drew it, because those brackets can't be replayed without it.~~ Changed in ticket 17: it deletes only its own matches; tournaments that drew it end with status `removed` (no tournament ranking, can't continue) and their other matches still count. Picture files no other contestant uses are removed on delete and on picture change.
  - The default cover is the top of the category's stored rated ranking, falling back to the unrated ranking until rated rankings exist (ticket 13), then to the first contestant by name.
  - "Added by" is hidden when a contestant or category has no creator (the sample catalog). Ticket 20 decides the "deleted player" wording.
  - The creator (or admin) can choose the cover at any time; the 10-contestant limit applies only to name and description.
  - Banned players are already refused catalog changes.
  - The server checks uploads by file signature and size (at most 700 KB per size), not by pixel dimensions. Server Action body limit raised to 2 MB.
  - `/contestants/[id]` is a minimal page (picture, name, added by, categories, edit/delete); ticket 16 fills it out.
  - `sharp` added as a devDependency only (tests generate WebP with it).
