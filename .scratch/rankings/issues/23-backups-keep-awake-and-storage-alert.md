# 23: Backups, keep-awake ping, and storage alert

**What to build:** The site protects its data and stays awake at no cost: weekly backups, a ping so the free Supabase project never pauses, and an alert before free limits are reached.

Setting up the Cloudflare R2 bucket and credentials needs the owner; prepare it as a short step-by-step rather than skipping it.

**Blocked by:** 01 (Working skeleton).

**Status:** done

- [x] A weekly GitHub Actions job dumps the database and syncs pictures to Cloudflare R2, keeping the last 8 weeks
- [x] Restoring from a backup into a fresh local Supabase is documented and tested once
- [x] A scheduled GitHub Actions ping keeps the free Supabase project from pausing
- [ ] The owner is alerted when database size, file storage, or egress passes 80% of the free limits (500 MB, 1 GB, 5 GB)
- [x] Everything stays within free tiers; secrets live in GitHub Actions secrets, never in the repo

## Comments

- Done in `e32282c`: workflows `rankings-backup` (weekly), `rankings-keep-alive` (daily), `rankings-storage-alert` (daily) in `.github/workflows/`; scripts in `rankings/scripts/ops/`; owner runbook in `rankings/docs/ops.md` (R2 bucket and token, the 10 GitHub secrets, restore steps).
- Backups: `supabase db dump` (roles, schema, data, gzipped) under `db/<date>/`, plus an rclone mirror of Supabase Storage (S3 protocol) under `pictures/current/`. Files deleted or overwritten by each sync go to `pictures/replaced/<date>/`. Both dated folders are pruned to the newest 8, so we don't store 8 full picture copies.
- Restore tested 2026-10-11: dumped the local database (read-only), restored into a throwaway Supabase Postgres container prepared like a fresh stack, and the tables, rows, RLS and policies came back. `roles.sql` is applied best-effort because the non-superuser `postgres` can't replay Supabase-managed grants; schema and data stay all-or-nothing.
- Deviation, egress unchecked above: the Supabase Management API has no egress or usage endpoint, so the alert covers database and file storage only. The runbook tells the owner to check the dashboard Usage page monthly.
- Validated with actionlint, action-validator and shellcheck. The storage check was run against the local DB and its issue logic against a stubbed `gh`. Backup and keep-alive haven't run against hosted Supabase or R2 yet.
- Needs the owner: create the R2 bucket and token, add the GitHub secrets, merge to `main` (schedules only run there), then trigger each workflow once by hand.

Code review follow-up (2026-10-11): the egress part of the unchecked criterion is an accepted deviation (the Management API has no egress endpoint). The alert covers database and file storage only, and the owner checks egress on the dashboard Usage page monthly, as `docs/ops.md` says.
