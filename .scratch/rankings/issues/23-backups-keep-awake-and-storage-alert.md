# 23: Backups, keep-awake ping, and storage alert

**What to build:** The site protects its data and stays awake at no cost: weekly backups, a ping so the free Supabase project never pauses, and an alert before free limits are reached.

Setting up the Cloudflare R2 bucket and credentials needs the owner; prepare it as a short step-by-step rather than skipping it.

**Blocked by:** 01 (Working skeleton).

**Status:** ready-for-agent

- [ ] A weekly GitHub Actions job dumps the database and syncs pictures to Cloudflare R2, keeping the last 8 weeks
- [ ] Restoring from a backup into a fresh local Supabase is documented and tested once
- [ ] A scheduled GitHub Actions ping keeps the free Supabase project from pausing
- [ ] The owner is alerted when database size, file storage, or egress passes 80% of the free limits (500 MB, 1 GB, 5 GB)
- [ ] Everything stays within free tiers; secrets live in GitHub Actions secrets, never in the repo
