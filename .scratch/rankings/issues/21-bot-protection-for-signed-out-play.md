# 21: Bot protection for signed-out play

**What to build:** Signed-out play is protected so scripts can't flood the unrated rankings, without bothering real visitors.

**Blocked by:** 03 (Play an unrated tournament while signed out), 08 (Unrated Infinite Mode).

**Status:** ready-for-agent

- [ ] Signed-out sessions are verified with Cloudflare Turnstile (free, usually invisible) before their picks are accepted
- [ ] Signed-out picks are rate-limited per visitor ID and per IP, defaulting to 30 picks per minute
- [ ] Over the limit, the visitor sees a friendly "slow down" message and no match is stored
- [ ] Signed-in play is unaffected
- [ ] Game service tests cover rejection of unverified signed-out picks and the rate limit
