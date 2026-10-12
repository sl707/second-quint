# 01: Working skeleton

**What to build:** An empty Second Quint Rankings app that is live at `rankings.secondquint.com`, reads from the database, and has every test seam from the spec running, so all later tickets only add behavior. See the spec (`.scratch/rankings/spec.md`) and `docs/adr/0001-ranking-app-on-separate-subdomain.md`.

Some steps need the owner (creating the Vercel and Supabase projects, adding the DNS record for the subdomain). Prepare those as a short step-by-step for the owner rather than skipping them.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A Next.js app lives in its own folder of this repo and runs locally with one command
- [x] A local Supabase (via the Supabase CLI) starts with one command, with database migrations checked into the repo
- [x] A hosted Supabase project (free plan) and a Vercel project (Hobby plan) exist, and the app deploys from the repo
- [x] `rankings.secondquint.com` serves the app over HTTPS; the GitHub Pages homepage at `secondquint.com` is unaffected
- [x] One page titled "Second Quint Rankings" reads and shows a value from the database, proving the app-to-database path end to end
- [x] Test seam 1 (game service against local Supabase) runs with one example test
- [x] Test seam 2 (pure ranking calculation) runs with one example test
- [x] Test seam 3 (browser tests at a phone viewport) runs with one example test
- [x] All three test suites run in CI on every push

## Comments

Done. Local skeleton in 16b6316. Production: Supabase project `second-quint-rankings` (ref bbcqmidieuassldqdoro, us-east-1, free plan; DB password in the owner's macOS Keychain as `second-quint-rankings-db-password`), Vercel project `second-quint-rankings` in the personal `sl707s-projects` team (root directory `rankings`, Next.js preset), `rankings.secondquint.com` via a Porkbun CNAME, HTTPS verified, home page reads from the production database. CI green on push and PR. Deployments currently go out with `vercel deploy --prod` from a clean checkout; Git-triggered deploys aren't connected yet.
