# 05: Google sign-in and display name

**What to build:** Visitors can sign in with Google, pick a display name the first time, and get a basic public profile page. Matches played while signed in are recorded against the player instead of an anonymous visitor ID.

**Blocked by:** 01 (Working skeleton).

**Status:** done

- [x] Sign in and sign out with Google only (Supabase Auth)
- [x] First sign-in requires choosing a display name: unique (case-insensitive), 3–24 characters
- [x] Real names and emails are never shown anywhere in the app
- [x] Each player has a public profile page at a stable address showing their display name
- [x] Matches played while signed in are stored with the player, not an anonymous visitor ID
- [x] Browsing and playing still work fully while signed out
- [x] Game service tests cover display name uniqueness and length rules
- [x] A browser test signs in (with a test auth stub) and picks a display name

## Comments

Implemented in 55f6405 (merged with `feat/rankings` in 9e78df0).

- `players` table (migration `20261011234731_players.sql`): `user_id` → `auth.users`, `display_name` with a length/charset check, and a generated `display_name_key = lower(display_name)` that is unique and used for profile lookups. Anyone can read `id, display_name, is_admin, banned, created_at`; `user_id` isn't readable from the browser. Foreign keys to `players` added for `tournaments.player_id`, `matches.player_id`, `contestants.created_by`, `categories.created_by`, `category_memberships.added_by`.
- Game service functions take a `Person` (visitor or signed-in player). `src/lib/session.ts` decides which one; `src/proxy.ts` refreshes the Supabase session with `@supabase/ssr`.
- Pages: `/auth/callback` (exchanges the code, sends first-timers to `/welcome`), `/welcome` (choose display name), `/players/[name]` (display name in any case, or player ID), and a header with sign in / sign out.
- Deviations:
  - Display names are restricted to ASCII letters, digits, `_` and `-` (no spaces), so they read cleanly in a profile address. Players can't rename themselves (the admin rename comes later).
  - The player row is created when the display name is chosen, so a signed-in user without one isn't a player yet. They're redirected to `/welcome` on full page loads and when they try to play.
  - `config.toml` sets `[auth.email] enable_signup = false` (Google only). The browser test stub creates a user through the admin API and starts the session with an admin-issued magic link from the test process, so the app has no test-only sign-in route.
  - Signed-out tournaments aren't moved to the player at sign-in.
  - Signed-in tournaments are still unrated until the rated-allowance tickets.
- Production setup: create a Google OAuth client with redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. In Supabase, enable the Google provider with that client ID and secret, disable the Email provider, set Site URL to `https://rankings.secondquint.com`, and add `https://rankings.secondquint.com/**` to the redirect URLs.

Code review follow-up (2026-10-11): display names are no longer ASCII-only. They allow letters and digits from any script, single spaces between words, `_` and `-`: 3–24 characters after NFC composing, trimming, and collapsing inner whitespace, still unique ignoring case. Migration `unicode_display_names` replaces `players_display_name_check`. Profile links URL-encode the name; `getProfile` matches it with `ILIKE`, so it folds case exactly like the unique key.
