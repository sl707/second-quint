Status: ready-for-agent

# Spec: Second Quint Rankings

## Problem Statement

Second Quint is a one-page site showing a full-screen GIF. The owner wants a fun, general-purpose ranking site attached to it, where anyone can decide "which is better?" between pairs of things — idols, pizza toppings, anything — and see how everyone's choices add up.

Today there's nowhere to do that. Existing bracket tools produce one-off results that disappear, can't be combined across many people, ignore how strong each opponent was, and are easy for one enthusiastic fan to flood. People also want to see their own taste reflected back at them, not just the crowd's.

The site must cost as close to nothing as possible to run.

## Solution

A separate app, **Second Quint Rankings**, at `rankings.secondquint.com`, linked from a small "Rankings" button on the homepage.

Anyone can browse a shared catalog of **contestants** (a name and a picture) grouped into **categories**, and pick winners in 1v1 **matches** in two ways: **tournaments** (single-elimination brackets) and **Infinite Mode** (endless matchups). Every match feeds **global rankings** (everyone's picks combined) and the player's own **personal rankings**, each available per category and overall, in a **rated** version (protected by a per-account daily **rated allowance**) and an **unrated** version (every match counts).

Rankings use a Bradley–Terry model that accounts for strength of opponents and confidence, chosen after a simulated comparison of algorithms. Contestants are ordered by a **score** (the low end of their rating range), so unproven contestants have to earn their place.

Accounts use Google sign-in with a public **profile** under a chosen **display name**. Everything runs on free tiers: Vercel for the app, Supabase for the database, sign-in and picture storage, Cloudflare for bot protection and backups.

## User Stories

### Homepage

1. As a homepage visitor, I want the GIF to stay full-screen and unchanged, so that the homepage keeps its character.
2. As a homepage visitor, I want a small "Rankings" button in the top-right corner, so that I can find the ranking app.
3. As a homepage visitor, I want the Rankings button to open the app in the same tab, so that navigation feels like one site.

### Accounts and profiles

4. As a visitor, I want to browse rankings, contestants, categories, and profiles without signing in, so that I can explore before committing.
5. As a visitor, I want to play tournaments and Infinite Mode without signing in, so that I can try the site instantly.
6. As a visitor, I want my unfinished tournaments to resume in the same browser, so that I don't lose progress by closing the tab.
7. As a visitor, I want to sign in with Google, so that I don't need another password.
8. As a new player, I want to pick a display name at first sign-in, so that my real name and email are never shown.
9. As a player, I want my display name to be unique, so that people can find and recognize my profile.
10. As a player, I want a public profile showing my personal rankings and past tournaments, so that I can share my taste.
11. As a profile viewer, I want to switch a profile's personal rankings between Rated and Unrated, so that I can see either version.
12. As a visitor, I want to search for players by display name, so that I can find a friend's profile.
13. As a visitor, I want "Added by …" on contestants and categories to link to the creator's profile, so that I can see who contributed them.
14. As a player, I want to delete my account, so that my profile, personal rankings, and display name are removed.
15. As a player deleting my account, I understand my matches and contestants stay anonymously, so that global rankings aren't disrupted.

### Catalog

16. As a signed-in player, I want to add a contestant with a name and a picture, so that it can appear in matches.
17. As a signed-in player adding a contestant, I want to see existing contestants with similar names, so that I don't create a duplicate.
18. As a signed-in player, I want to upload a picture from my device, so that I can use my own image.
19. As a signed-in player, I want to paste a link to a picture and have the site copy it, so that I don't have to download and re-upload images.
20. As a player adding a picture, I want it automatically shrunk before upload, so that the site stays fast and free to run.
21. As a player adding an animated GIF, I understand only its first frame is kept, so that pictures stay small.
22. As a signed-in player, I want to create a category with a name and description, so that I can start a new subject to rank.
23. As a category creator, I want to choose a contestant as the category's cover picture, so that the category looks good in lists.
24. As a visitor, I want a category without a chosen cover to show its top contestant, so that every category has a picture.
25. As a signed-in player, I want to add existing contestants to any category, so that categories grow collaboratively.
26. As a contestant's creator, I want to edit or delete it until its first rated match, so that I can fix mistakes.
27. As a category's creator, I want to edit its details until it has 10 contestants, so that I can fix mistakes before it gets popular.
28. As a visitor, I want a contestant page showing its score in every category it's in and overall, its win-loss record, a rating-over-time chart, and head-to-head records, so that I can understand how it's doing.
29. As a visitor, I want to report a contestant, category, or profile, so that the admin can remove inappropriate content.

### Tournaments

30. As a player, I want to start a tournament from one category or from all contestants, so that I can rank within a subject or across everything.
31. As a player, I want to choose any tournament size from 4 up to everyone in the scope, defaulting to 16, so that I can play short or epic brackets.
32. As a player, I want contestants drawn at random and placed randomly in the bracket, so that every tournament is fresh and fair.
33. As a player, I want byes when the size isn't a power of two, so that any size works.
34. As a player, I want a third-place match, so that 3rd and 4th are decided.
35. As a player, I want to hand-pick a tournament's contestants, so that I can settle a specific debate, knowing it will be unrated.
36. As a player, I want to see the whole bracket at all times, so that I always know where I am.
37. As a player, I want a "matches left" counter, so that long tournaments feel finite.
38. As a player, I want to undo my most recent pick until I make the next one, so that a mis-tap doesn't ruin a tournament.
39. As a player, I want to see my tournament ranking (1st, 2nd, 3rd, 4th, then tiers) when I finish, so that I get a satisfying result.
40. As a signed-in player, I want to resume an unfinished tournament on any device, so that I can finish later.
41. As a signed-in player, I want a banner reminding me of unfinished tournaments, so that I don't forget them.
42. As a player, I want to be told before a tournament starts whether it will be rated or unrated, and why, so that there are no surprises.
43. As a signed-in player, I want to switch a tournament to unrated before starting, so that I can play casually without using my allowance.
44. As a signed-in player with an unfinished rated tournament, I want to Give Up on it, so that I can start a new rated tournament.

### Infinite Mode

45. As a player, I want Infinite Mode on one category or all contestants, so that I can keep picking for as long as I like.
46. As a player, I want Infinite Mode to show interesting pairs (contestants with few matches or close ratings) with some randomness, so that my picks are meaningful without feeling scripted.
47. As a player, I want to Skip a pair I can't decide on, so that I'm not forced into meaningless picks.
48. As a signed-in player, I want to know how many rated skips I have left today, so that I can use them wisely.
49. As a player playing unrated, I want unlimited skips, so that casual play is relaxed.
50. As a signed-in player, I want Infinite Mode to switch to unrated when my allowance runs out, so that I can keep playing.

### Rated allowance

51. As a signed-in player, I want to see my remaining rated allowance per scope, so that I know how many more of my picks will count today.
52. As a signed-in player, I want a countdown to the midnight Eastern reset, so that I know when my allowance refreshes.
53. As a site owner, I want a rated tournament to reserve all its matches from the allowance when it starts, so that one tournament can't exceed the daily cap.
54. As a site owner, I want reserved allowance never returned for unplayed matches, so that abandoning and re-drawing for a favorite is expensive.
55. As a site owner, I want each player limited to one unfinished rated tournament at a time, so that re-drawing can't be done in parallel.
56. As a signed-in player, I want a resumed rated tournament's remaining matches to stay rated without using the new day's allowance, so that finishing later isn't penalized.

### Rankings

57. As a visitor, I want a global ranking for each category and an overall ranking of every contestant, so that I can see both focused and cross-subject standings.
58. As a visitor, I want rankings to account for strength of opponents, so that beating strong contestants counts for more.
59. As a visitor, I want contestants with few matches held back until they've proven themselves, so that lucky streaks don't top the rankings.
60. As a visitor, I want rankings to show one score per contestant, ordered by that score, so that the order always matches the numbers.
61. As a visitor, I want contestants with no matches listed separately as "not yet judged", so that the ranking isn't padded with guesses.
62. As a visitor, I want to switch any ranking between Rated and Unrated, defaulting to Rated, so that I can see the protected view or every pick.
63. As a visitor, I want global rankings to refresh every 5 minutes, so that they stay current.
64. As a player, I want my personal rankings to update instantly after each match, so that I see my taste take shape as I play.
65. As a player, I want personal rankings built purely from my own matches, never padded with the crowd's opinion, so that they really are mine.
66. As a player, I want my personal rankings to weigh all my matches equally forever, so that my history isn't erased by fading.
67. As a visitor, I want global rankings to favor recent matches, so that they follow changing tastes.

### Moderation and admin

68. As the admin, I want a queue of reports, so that I can review and act on them.
69. As the admin, I want to edit or delete any contestant or category, so that I can fix or remove bad content.
70. As the admin, I want to remove a contestant from a category, so that categories stay on topic.
71. As the admin, I want to merge duplicate contestants, combining their match histories and categories, so that the catalog stays clean.
72. As the admin, I want to rename a player's display name, so that offensive names can be fixed.
73. As the admin, I want to ban a player, optionally removing their matches from rankings, so that abusers can be stopped and their influence undone.
74. As the admin, I want to see the share of tournaments finished, overall and by round, so that I know whether people abandon brackets.

### Safety and operations

75. As the site owner, I want signed-out play protected by an invisible human check and a rate limit, so that bots can't flood the unrated rankings.
76. As the site owner, I want weekly automatic backups of the database and pictures, so that one mistake can't wipe everything.
77. As the site owner, I want the free database kept from pausing due to inactivity, so that the site never goes dark.
78. As the site owner, I want an alert when storage reaches 80% of the free limit, so that I can act before anything breaks.
79. As a phone user, I want the app designed for phones first, with the two contestants stacked, so that playing one-handed is comfortable.
80. As a desktop user, I want the two contestants side by side, so that the larger screen is used well.

## Implementation Decisions

### Architecture (see `docs/adr/0001-ranking-app-on-separate-subdomain.md`)

- The homepage stays static HTML on GitHub Pages; the only change is the Rankings button.
- The ranking app is a new Next.js app in its own folder of this repo, deployed on the Vercel free (Hobby) plan at `rankings.secondquint.com`. The site must stay non-commercial, which that plan requires.
- Supabase free plan provides Postgres, Google sign-in (Supabase Auth), and picture storage.
- Scheduled work runs on Supabase (pg_cron invoking an Edge Function), because Vercel Hobby cron jobs are limited to once per day. Weekly backups and the keep-alive ping run as GitHub Actions jobs.

### Modules

- **Ranking calculation** (pure, no I/O). Input: a list of matches (winner, loser, played-at time) and options (half-life in days, or none; the current time). Output: for each contestant with at least one match — rating, ± range, score, wins, losses, match count — plus the list of contestants in scope with no matches ("not yet judged"). One function serves all eight ranking combinations; only the inputs and half-life differ.
- **Game service** (server-side operations; the main test seam). Owns every play rule and writes matches. Operations: start tournament, pick winner, undo last pick, give up, next Infinite Mode pair, record Infinite Mode pick, skip, read allowance status.
- **Catalog service**. Add/edit/delete contestant, similar-name lookup, add contestant to category, create/edit category, set cover, copy picture from link, report.
- **Admin service**. Report queue, merge contestants, remove contestant from category, delete category, rename player, ban (with optional match removal), completion-rate view.
- **Ranking refresher** (scheduled every 5 minutes). Recomputes all global rankings (each category plus overall, rated and unrated) with the ranking calculation and stores the ready-made lists for fast reads. Takes weekly rating snapshots for the over-time charts.
- **Personal rankings**. Computed on request from one player's matches through the ranking calculation (small data, so effectively instant).
- **Profiles**. Display name selection, uniqueness, search, profile page data, account deletion.
- **App UI**. Phone-first pages: home, category, contestant, tournament play, Infinite Mode, rankings, profile, search, admin.

### Ranking algorithm (validated in the prototype)

- Bradley–Terry, fit by the minorization–maximization method over aggregated pair counts. Every contestant gets one virtual win and one virtual loss against an average phantom opponent, which anchors the scale and tames contestants with few matches.
- **Global rankings** weight each match by `0.5 ^ (age in days / 30)` — a 30-day half-life. **Personal rankings** use no fading.
- Strength `θ = ln p`. Uncertainty `SE = 1 / sqrt(information)`. Displayed on an Elo-like scale: `rating = 1500 + 173.7 × θ`, range `± 2 × 173.7 × SE`.
- **Score = rating − range** (the low end). Rankings are ordered by score. The contestant page shows rating ± range.
- The implementation must use sparse pair counts, not the prototype's dense matrix, so the overall ranking scales to thousands of contestants.

Core of the fit, trimmed from the prototype:

```js
// W[i][j] = (faded) wins of i over j; p = strengths, start at 1
for (let iter = 0; iter < 40; iter++) {
  p = p.map((pi, i) => {
    let wins = 1, den = 2 / (pi + 1);               // phantom: 1 win, 1 loss vs strength 1
    for (const j of opponents(i)) {
      const nij = W[i][j] + W[j][i];
      wins += W[i][j];
      den += nij / (pi + p[j]);
    }
    return wins / den;
  });
}
// information for SE: 2·pi/(pi+1)² + Σ nij·pi·pj/(pi+pj)²
```

### Which rankings a match feeds

- A match whose scope is a category feeds that category's rankings and the overall rankings. A match drawn from all contestants feeds only the overall rankings. This applies to both global and personal rankings.
- **Rated rankings** use only rated matches. **Unrated rankings** use every match: rated or not, Infinite Mode, hand-picked and unfinished tournaments, and signed-out play (global only).
- Matches by banned players with "remove matches" chosen are excluded from all rankings (flagged, not deleted, so a ban can be reversed).

### Rated allowance and rated status

- **Rated allowance** per account, per scope, per day = number of contestants currently in the scope, minimum 20, maximum 500 for the all-contestants scope. Days run midnight to midnight `America/New_York`.
- **Tournament rated status** is decided at start, for the whole tournament. It's rated only if the player is signed in, hasn't chosen unrated, the contestants were randomly drawn, the player has no other unfinished rated tournament (in any scope), and the tournament's N matches (N contestants = N matches, counting the third-place match) fit in the remaining allowance. Otherwise it's unrated, and the player is told why before starting.
- A rated tournament **reserves all N matches** against its start day's allowance. Unplayed reserved matches are never returned. Each of its matches is rated and counts the moment it's picked, whenever it's played; resuming never touches a later day's allowance.
- **Give Up** ends an unfinished rated tournament: played matches stay, there's no tournament ranking, and nothing is refunded.
- **Infinite Mode**: a pick is rated if the player is signed in, hasn't chosen unrated, and has allowance left in that scope at that moment.
- **Skips**: 5 per account per day while playing rated, across all Infinite Mode; unlimited while unrated.

### Tournament rules

- Size from 4 to the scope's contestant count (the scope needs at least 4); default 16, or the scope size if smaller. Infinite Mode needs a scope of at least 2.
- Random draw, then random placement. The bracket size is the next power of two, and byes are each paired with a real contestant in round one (never bye vs. bye). There's a third-place match between the semifinal losers when both exist.
- Hand-picked tournaments: the player chooses the contestants (at least 4) from the scope, and the tournament is always unrated.
- Undo: removes the player's most recent pick (and its match) only if the next match hasn't been picked yet.
- **Tournament ranking** is computed at finish: 1st, 2nd, 3rd, 4th, then tied tiers by round of elimination. Unfinished tournaments show as "in progress".

### Infinite Mode pairing (from the prototype)

- The first contestant is weighted by `1 + 3 / (1 + matches)`. The second is weighted by the same boost × `(exp(−k × |rating difference|) + 0.1)`, using the scope's latest global rated ratings, which gives a mix of close, informative pairs and randomness. The constant `k` is tuned during implementation.

### Data model (Postgres)

- **Players**: auth user link, display name (unique, case-insensitive, 3–24 characters), admin flag, banned flag, created at.
- **Contestants**: name, picture (512 and 128 versions), creator, created at, merged-into (for redirects after a merge).
- **Categories**: name, description (up to 280 characters), cover contestant (nullable), creator, created at.
- **Category memberships**: contestant, category, added by.
- **Tournaments**: player or anonymous visitor ID, scope, size, rated flag, hand-picked flag, reserved allowance, bracket state, status (in progress / finished / given up), allowance day, created and finished times.
- **Matches**: winner, loser, scope, player or anonymous visitor ID, rated flag, tournament (nullable), round (for tournament matches), played at, excluded flag.
- **Allowance use**: player, scope, day, rated matches used.
- **Skip use**: player, day, rated skips used.
- **Reports**: reporter, target type (contestant / category / profile), target, reason, status.
- **Ranking lists**: the stored output of each refresh (version, scope, rated/unrated, entries).
- **Rating snapshots**: weekly snapshots of global rated ratings for the over-time chart.
- Row-level security: anyone can read public data; players write only their own play and catalog entries within the edit rules; admin-only operations are enforced in the service and the policies.

### Catalog rules

- A contestant's name and picture can be edited or the contestant deleted by its creator until its first rated match, then only by the admin.
- A category's details can be edited by its creator until it has 10 contestants, then only by the admin. Only the admin removes contestants from categories or deletes categories.
- The cover is a contestant from the category, chosen by the creator; if none is chosen, it's the top contestant by rated score.
- Similar-name warning: case- and accent-insensitive fuzzy match against existing names when adding.
- **Merge**: re-points the duplicate's matches and memberships to the survivor, drops matches between the two, and redirects the duplicate's page.
- Removing a contestant from a category, or deleting a category, drops it from those category rankings. Its matches still count toward overall.

### Pictures

- Accepted inputs: JPG, PNG, WebP, GIF, up to 5 MB.
- The browser does all resizing: a center-cropped square at 512 px (matches) and 128 px (lists), WebP, still image only (first frame of a GIF).
- **Copy from link**: a server function fetches the image (enforcing size and type limits, refusing private and internal addresses, following limited redirects) and hands it back to the browser, which runs the same resize as an upload. Hotlinking is never used.
- Stored in Supabase Storage under content-addressed names with a permanent cache header.

### Signed-out play and abuse protection

- Signed-out visitors get an anonymous visitor ID stored in the browser. Their matches are stored as unrated and feed global unrated rankings. Their tournaments resume in the same browser.
- Cloudflare Turnstile verifies signed-out sessions. A rate limit applies per visitor ID and per IP; the default is 30 picks per minute.

### Account deletion

- Deletes the profile, display name, and personal rankings. Matches are re-pointed to an anonymous tombstone, and contestants and categories stay with "Added by a deleted player".

### Operations and cost

- **Ranking refresh**: pg_cron every 5 minutes calls an Edge Function (about 8,600 calls a month, well under the free 500,000).
- **Keep-alive**: a scheduled GitHub Actions ping, so the free Supabase project never pauses.
- **Backups**: weekly GitHub Actions job dumps the database and syncs pictures to Cloudflare R2 (free 10 GB), keeping 8 weeks.
- **Storage alert**: notify the admin when database or file storage passes 80% of the free limits (500 MB database, 1 GB files, 5 GB egress).
- If picture egress outgrows the free tier, pictures move to Cloudflare R2 instead of upgrading Supabase.

### Homepage

- Add a small pill button labeled "Rankings" fixed to the top-right corner of the existing page, linking to `https://rankings.secondquint.com` in the same tab. Nothing else on the homepage changes.

## Testing Decisions

- **What makes a good test**: it drives the app the way real usage does and checks observable outcomes — what's stored, what a ranking returns, what a player is allowed to do — never internal implementation details. Tests survive refactors of anything behind the seam.
- **Seam 1 — Game service (main seam)**: tests call the server-side operations against a real local Supabase (Supabase CLI) and assert outcomes. Coverage includes:
  - Rated eligibility at start: each reason a tournament is unrated.
  - Allowance: size formula (minimum 20, overall cap 500), reservation, no refunds, midnight Eastern reset.
  - Rated tournaments resumed across days.
  - One unfinished rated tournament at a time, and Give Up.
  - Undo rules.
  - Skips: limits while rated, unlimited while unrated.
  - Infinite Mode switching to unrated when the allowance runs out.
  - Which rankings each match feeds.
  - Catalog edit permissions; merge, removal, and ban effects; account deletion anonymization.
  - Signed-out play is unrated.
- **Seam 2 — Ranking calculation (pure)**: tests feed match lists and check rankings, using fixtures modeled on the prototype's scenarios:
  - A strong newcomer rises but doesn't jump to #1 on two lucky wins.
  - Strength of opponents beats raw win rate across a strong and a weak category.
  - Fading follows a change in taste; no fading keeps old matches.
  - Contestants with no matches go to "not yet judged".
  - Score ordering matches the low end of the range.
- **Seam 3 — Browser tests (thin)**: three or four phone-viewport walkthroughs: play a full tournament to its tournament ranking, sign in and pick a display name, play Infinite Mode with a skip, switch a ranking between Rated and Unrated. These catch broken wiring and don't re-test rules.
- **Prior art**: none in this repo (greenfield). The prototype `rankings/PROTOTYPE-global-ranking-algorithms.html` is the behavioral reference for seam 2.

## Out of Scope

- **Catalog**:
  - Optional contestant details (description, links, other names, picture credit).
  - Several pictures per contestant.
  - Category-specific facts.
  - Sub-categories.
  - Suggested edits.
  - An approval queue for new content.
- **Sign-in and admin**: sign-in methods other than Google; moderators other than the single admin.
- **Playing**:
  - Draws.
  - Seeded brackets.
  - Double elimination, Swiss, or other formats.
  - Live multiplayer voting.
- **Pictures**: animated pictures; hotlinked pictures.
- **Social and outreach**: comments, likes, follows, share buttons, email or push notifications.
- **Other**:
  - Ads or paid features.
  - Languages other than English.
  - A public API or data export.
  - Analytics beyond Vercel's free basics.
- **Homepage**: migrating it to Next.js (the existing `feat/nextjs-setup` branch stays unused).

## Further Notes

- **Defaults to review** (proposed here, not yet confirmed by the owner):
  - Weekly rating snapshots, for rated global rankings only.
  - A storage alert at 80%.
  - A signed-out rate limit of 30 picks per minute.
  - Display names that are unique and 3–24 characters.
  - The category cover is chosen from the category's own contestants rather than uploaded separately.
  - The Infinite Mode pairing constant is tuned in implementation.
- **Storage headroom**: at about 150 bytes per match with indexes, the free 500 MB database holds roughly 3 million matches. If growth approaches that, options include condensing very old unrated matches into pair totals (giving up exact recomputation of old unrated history) or upgrading.
- **Algorithm evidence** (20-seed averages from the prototype, about two matches per contestant per day):
  - With a strong and a weak category and only 10% cross-category play, Bradley–Terry scored 95/100 on the overall ranking after 30 days, against 80–82 for Glicko-2 and TrueSkill, 77 for Elo, and 72 for win rate.
  - At shorter half-lives, it also kept pace when tastes changed.
  - TrueSkill was excluded: it never won a scenario, and it's Microsoft's.
- **Prototype capture**: per the prototype skill, the prototype file should move to a throwaway branch rather than live on `main`; this spec keeps the validated decision.
- **Vocabulary**: all terms follow `GLOSSARY.md`.
