# 06: Add contestants and categories

**What to build:** Signed-in players grow the shared catalog: they add contestants with an uploaded picture, create categories, and add contestants to categories. Contributions go live immediately and show who added them.

**Blocked by:** 05 (Google sign-in and display name).

**Status:** ready-for-agent

- [ ] Signed-in players can add a contestant with a name and an uploaded picture (JPG, PNG, WebP, or GIF, up to 5 MB)
- [ ] The browser shrinks each picture before upload to a center-cropped square WebP at 512 px and 128 px, keeping only the first frame of a GIF
- [ ] Pictures are stored in Supabase Storage under content-addressed names with a permanent cache header
- [ ] While adding, a similar-name warning ("Did you mean…?") lists existing contestants with similar names (case- and accent-insensitive)
- [ ] Signed-in players can create a category with a name and a description (up to 280 characters)
- [ ] Signed-in players can add existing contestants to any category
- [ ] A category's creator can choose one of its contestants as the cover; with no choice, the cover is its top contestant by score
- [ ] Contestants and categories show "Added by …" linking to the creator's profile
- [ ] A contestant's creator can edit its name and picture, or delete it, until its first rated match; after that only the admin can
- [ ] A category's creator can edit its details until it has 10 contestants; after that only the admin can
- [ ] New contestants and categories go live immediately and can be played
- [ ] Game service tests cover the edit and delete permission rules for contestants and categories
