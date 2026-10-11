# 01: Working skeleton

**What to build:** An empty Second Quint Rankings app that is live at `rankings.secondquint.com`, reads from the database, and has every test seam from the spec running, so all later tickets only add behavior. See the spec (`.scratch/rankings/spec.md`) and `docs/adr/0001-ranking-app-on-separate-subdomain.md`.

Some steps need the owner (creating the Vercel and Supabase projects, adding the DNS record for the subdomain). Prepare those as a short step-by-step for the owner rather than skipping them.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A Next.js app lives in its own folder of this repo and runs locally with one command
- [ ] A local Supabase (via the Supabase CLI) starts with one command, with database migrations checked into the repo
- [ ] A hosted Supabase project (free plan) and a Vercel project (Hobby plan) exist, and the app deploys from the repo
- [ ] `rankings.secondquint.com` serves the app over HTTPS; the GitHub Pages homepage at `secondquint.com` is unaffected
- [ ] One page titled "Second Quint Rankings" reads and shows a value from the database, proving the app-to-database path end to end
- [ ] Test seam 1 (game service against local Supabase) runs with one example test
- [ ] Test seam 2 (pure ranking calculation) runs with one example test
- [ ] Test seam 3 (browser tests at a phone viewport) runs with one example test
- [ ] All three test suites run in CI on every push
