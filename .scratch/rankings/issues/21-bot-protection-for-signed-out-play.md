# 21: Bot protection for signed-out play

**What to build:** Signed-out play is protected so scripts can't flood the unrated rankings, without bothering real visitors.

**Blocked by:** 03 (Play an unrated tournament while signed out), 08 (Unrated Infinite Mode).

**Status:** done

- [x] Signed-out sessions are verified with Cloudflare Turnstile (free, usually invisible) before their picks are accepted
- [x] Signed-out picks are rate-limited per visitor ID and per IP, defaulting to 30 picks per minute
- [x] Over the limit, the visitor sees a friendly "slow down" message and no match is stored
- [x] Signed-in play is unaffected
- [x] Game service tests cover rejection of unverified signed-out picks and the rate limit

## Comments

Done in 0ddcee7.

- **Built**: `src/server/human-check.ts`. `verifyVisitor` checks the Turnstile token with Cloudflare siteverify and stores `visitor_verifications.verified_until` (24 hours). `pickWinner` and `pickInfiniteWinner` call the service-role-only `claim_signed_out_pick` SQL function for visitors only: it refuses unverified visitors, locks on the visitor and IP, prunes `signed_out_picks` rows older than a minute, and allows 30 per rolling minute per visitor ID and per IP. Refusals are `SignedOutPlayError` (a `GameError`); the play actions show the message ("Slow down! …") and store no match. The tournament and Infinite Mode play pages show `HumanCheck` (Turnstile in `interaction-only` appearance) in place of the match until the visitor is verified. The IP comes from `x-forwarded-for` (Vercel overwrites it).
- **Env**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`. `write-local-env.mjs` writes Cloudflare's always-pass test keys, so local, test, and CI runs use them. If either key is missing, signed-out picks are refused with "the human check isn't set up". Documented in `rankings/AGENTS.md` and `docs/ops.md` (production setup steps).
- **Tests**: 8 service tests (`signed-out-protection.test.ts`): unverified tournament and Infinite Mode picks refused; always-fail secret; missing secret; expiry; per-visitor limit with recovery after a minute; per-IP limit across visitor IDs; signed-in players not checked or limited. These call the real siteverify with the test keys. Existing service tests that pick while signed out use `newVerifiedVisitor`. One new e2e checks the "Slow down!" message; the existing signed-out e2e tests go through the real test widget.
- **Deviations**:
  - Only picks are guarded. Starting tournaments, skips, and undo store no matches, so they're unchecked.
  - The check lasts 24 hours per visitor ID rather than a browser session, and it isn't tied to an IP.
  - Tests and e2e need internet access to `challenges.cloudflare.com`.
  - `GameError` moved to `src/server/game-error.ts` (re-exported from `game.ts`) to avoid a circular import. Tournament pick buttons became a client `MatchPicker` so they can show the refusal message.
