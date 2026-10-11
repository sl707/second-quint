# 05: Google sign-in and display name

**What to build:** Visitors can sign in with Google, pick a display name the first time, and get a basic public profile page. Matches played while signed in are recorded against the player instead of an anonymous visitor ID.

**Blocked by:** 01 (Working skeleton).

**Status:** ready-for-agent

- [ ] Sign in and sign out with Google only (Supabase Auth)
- [ ] First sign-in requires choosing a display name: unique (case-insensitive), 3–24 characters
- [ ] Real names and emails are never shown anywhere in the app
- [ ] Each player has a public profile page at a stable address showing their display name
- [ ] Matches played while signed in are stored with the player, not an anonymous visitor ID
- [ ] Browsing and playing still work fully while signed out
- [ ] Game service tests cover display name uniqueness and length rules
- [ ] A browser test signs in (with a test auth stub) and picks a display name
