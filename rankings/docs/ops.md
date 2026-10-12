# Operations runbook

Three scheduled GitHub Actions workflows keep the hosted Supabase project safe and free. They only run from `main`, and only once the secrets below exist.

| Workflow | When | What it does |
| --- | --- | --- |
| `rankings-backup` | Sundays 03:17 UTC | Dumps the database and syncs pictures to Cloudflare R2, keeping the last 8 weeks |
| `rankings-keep-alive` | Daily | Queries the API and the database so the free project never pauses (it pauses after 7 idle days) |
| `rankings-storage-alert` | Daily | Opens or updates a `storage-alert` issue when database or file storage passes 80% of the free limits |

Scripts live in `rankings/scripts/ops/`. Every workflow also has a "Run workflow" button (Actions tab) for a manual run.

## 1. Create the R2 bucket and API token (Cloudflare)

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) and open **R2 Object Storage**. Cloudflare may ask you to add a payment method to enable R2; the free tier (10 GB stored, free egress) covers these backups.
2. **Create bucket**: name `second-quint-rankings-backups`, location Automatic, storage class **Standard** (Infrequent Access has minimum charges). Leave public access off.
3. On the R2 overview page, copy your **Account ID**.
4. **Manage API tokens** → **Create Account API token**:
   - Permissions: **Object Read & Write**
   - Specify bucket(s): only `second-quint-rankings-backups`
   - TTL: Forever
5. Copy the **Access Key ID** and **Secret Access Key** now; the secret is shown once.
6. **Budget alert** (Cloudflare has no hard spending cap, only alerts): **Manage Account → Billing → Billable Usage → Create budget alert**, threshold at the lowest amount it accepts (for example $1), your email as recipient. If Cloudflare already created a default $10 alert, lower it.

### R2 spend guardrails

R2 has no spending cap, so staying at $0 is enforced in layers:

- **Only one writer.** The token above can touch only this bucket, and only the backup job uses it. Public access stays off, and Cloudflare doesn't bill requests it rejects as unauthorized.
- **Hard limit in the job.** Before uploading, `backup.sh` adds the bucket's current size, the new dump, and every picture (as if all were re-uploaded). If that passes **8 GB** (80% of the free 10 GB), or a run would touch over 100,000 pictures, it uploads nothing, exits with an error, and the workflow opens a "Rankings backup failed" issue, which GitHub emails you.
- **Bounded by design.** The database can't exceed Supabase's free 500 MB, dumps are gzipped, and only 8 weeks are kept; old backups are pruned *before* each upload. A weekly run makes a few thousand Class A operations at most, against 1 million free a month.
- **Standard storage only.** The free tier doesn't cover Infrequent Access; never add lifecycle rules that move objects there.
- **Budget alert** (step 6) as the last line: an email the day after any charge appears.

## 2. Collect the Supabase values

In the Supabase dashboard for the production project:

1. **Project ID** (the "project ref"): Project Settings → General.
2. **Database URL**: click **Connect** → **Session pooler** and copy the URI (`postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`). Put in the database password (URL-encode special characters). Use the session pooler, not the direct connection: GitHub runners have no IPv6, and the direct host is IPv6-only.
3. **Storage S3 keys**: Storage → S3 Configuration (under Storage settings). Make sure the S3 connection is enabled, note the **Region**, then **New access key** and copy the access key ID and secret. These keys have full Storage access; keep them only in GitHub secrets.
4. **Publishable key**: Project Settings → API Keys (`sb_publishable_...`).

## 3. Add the GitHub secrets

GitHub repo → Settings → Secrets and variables → Actions → **New repository secret**, one per row (or `gh secret set NAME` from a terminal):

| Secret | Value | Used by |
| --- | --- | --- |
| `SUPABASE_DB_URL` | Session pooler URI with password (step 2.2) | backup, keep-alive, storage alert |
| `SUPABASE_PROJECT_REF` | Project ID (step 2.1) | backup, keep-alive |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key (step 2.4) | keep-alive |
| `SUPABASE_S3_REGION` | Storage S3 region (step 2.3) | backup |
| `SUPABASE_S3_ACCESS_KEY_ID` | Storage S3 access key ID (step 2.3) | backup |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | Storage S3 secret (step 2.3) | backup |
| `R2_ACCOUNT_ID` | Cloudflare account ID (step 1.3) | backup |
| `R2_ACCESS_KEY_ID` | R2 token access key ID (step 1.5) | backup |
| `R2_SECRET_ACCESS_KEY` | R2 token secret (step 1.5) | backup |
| `R2_BUCKET` | `second-quint-rankings-backups` | backup |

The storage alert uses the workflow's built-in `GITHUB_TOKEN`; nothing to add.

Then, once the workflows are on `main`, run each one manually from the Actions tab and check that `rankings-backup` created `db/<today>/` and `pictures/current/` in the R2 bucket.

## Ranking refresh (every 5 minutes)

Supabase pg_cron runs `refresh-global-rankings` every 5 minutes. It uses pg_net to `POST` the app's `/api/rankings/refresh` with a shared secret, and the app recomputes and stores every global ranking. Until the two Vault secrets below exist, the job does nothing.

1. Generate a secret (`openssl rand -hex 24`) and set it as `RANKINGS_REFRESH_SECRET` in Vercel (Production), then redeploy.
2. In the Supabase SQL editor for the production project:

   ```sql
   select vault.create_secret('https://rankings.secondquint.com/api/rankings/refresh', 'rankings_refresh_url');
   select vault.create_secret('<the same secret>', 'rankings_refresh_secret');
   ```

3. Check: after 5 minutes, `select status_code, content from net._http_response order by id desc limit 3;` shows `200` responses, and `select jobname, status, start_time from cron.job_run_details order by start_time desc limit 3;` shows successful runs.

To rotate the secret, change it in Vercel, redeploy, then `select vault.update_secret((select id from vault.secrets where name = 'rankings_refresh_secret'), '<new secret>');`.

## Notifications and things to watch

- **Storage alert**: you're notified through the GitHub issue (you watch your own repo by default). It's created once, its numbers are refreshed daily without notifying, and it gets a comment when a different resource crosses 80%. Close it after acting; it reopens as a new issue if usage crosses again.
- **Egress isn't measured.** The Supabase Management API has no egress or billing-usage endpoint (only request counts), so the alert can't see the 5 GB monthly egress limit. Glance at Organization → **Usage** in the Supabase dashboard once a month. If picture egress grows, the plan (spec, Operations and cost) is to serve pictures from R2 rather than upgrade Supabase.
- **Failed runs**: GitHub emails the person who last edited a workflow's schedule when a scheduled run fails. A failing keep-alive or backup is worth checking within a few days.
- **GitHub pauses schedules in quiet repos**: in a public repo with no commits for 60 days, GitHub disables scheduled workflows (it emails first). Re-enable them in the Actions tab. If keep-alive was off long enough for the project to pause, restore it from the Supabase dashboard.
- Database size is `pg_database_size`, and file storage is the sum of object sizes in `storage.objects`. Both can differ slightly from the dashboard figures; the 80% margin absorbs that.

### When the storage alert fires

- **Database**: look for runaway tables (`select relname, pg_size_pretty(pg_total_relation_size(oid)) from pg_class order by pg_total_relation_size(oid) desc limit 10;`), old unfinished tournaments, or bloat (`vacuum full` on the largest table).
- **File storage**: remove pictures of deleted or merged contestants, and check uploads are being resized as intended.

## What's in a backup

```
db/YYYY-MM-DD/roles.sql.gz, schema.sql.gz, data.sql.gz   database dump, newest 8 kept
pictures/current/<storage bucket>/...                    pictures as of the latest backup
pictures/replaced/YYYY-MM-DD/<storage bucket>/...        pictures that backup deleted or overwrote, newest 8 kept
```

The database dump comes from `supabase db dump`, which includes your tables, policies, functions, and the `auth` and `storage` data (players' sign-ins and picture records), and leaves out Supabase's internal schemas.

## Restore a backup into a fresh local database

Use this to inspect a backup or rehearse a recovery. It needs Docker, Node, and `rclone` (`brew install rclone`). A restore needs an empty Supabase stack without this app's migrations, so it uses a scratch project; the local rankings stack is stopped meanwhile (its data is kept).

1. Stop the local rankings stack:
   ```bash
   cd rankings && npx supabase stop && cd ..
   ```
2. Start an empty Supabase in a scratch folder:
   ```bash
   mkdir -p /tmp/sq-restore && cd /tmp/sq-restore
   npx supabase init && npx supabase start
   ```
3. Point rclone at R2 (same values as the GitHub secrets; the Supabase ones are only needed by the script, any value works for a download), then download and unzip a backup. `rclone lsf r2:$R2_BUCKET/db/` lists the available dates.
   ```bash
   export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=second-quint-rankings-backups
   export SUPABASE_PROJECT_REF=x SUPABASE_S3_REGION=x SUPABASE_S3_ACCESS_KEY_ID=x SUPABASE_S3_SECRET_ACCESS_KEY=x
   source <repo>/rankings/scripts/ops/rclone-env.sh
   rclone copy "r2:$R2_BUCKET/db/2026-10-18" ./dump && gunzip ./dump/*.gz
   ```
4. Restore the database:
   ```bash
   <repo>/rankings/scripts/ops/db-restore.sh ./dump postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```
   An error like `permission denied for parameter log_min_messages` during the roles step is expected: those are Supabase's own roles, which already exist. Schema and data restore in one transaction, so any error there means nothing was restored.
5. Restore pictures (optional). `npx supabase status` prints the local S3 URL and keys:
   ```bash
   export RCLONE_CONFIG_LOCAL_TYPE=s3 RCLONE_CONFIG_LOCAL_PROVIDER=Other RCLONE_CONFIG_LOCAL_FORCE_PATH_STYLE=true \
     RCLONE_CONFIG_LOCAL_ENDPOINT=http://127.0.0.1:54321/storage/v1/s3 RCLONE_CONFIG_LOCAL_REGION=local \
     RCLONE_CONFIG_LOCAL_ACCESS_KEY_ID=<S3 access key> RCLONE_CONFIG_LOCAL_SECRET_ACCESS_KEY=<S3 secret key>
   rclone copy "r2:$R2_BUCKET/pictures/current" local:
   ```
6. Check it: open Studio at http://127.0.0.1:54323, or
   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c '\dt public.*'
   ```
7. Clean up and bring the rankings stack back:
   ```bash
   npx supabase stop --no-backup && cd - && cd rankings && npx supabase start
   ```

**Restoring production** after a disaster works the same way: create a new Supabase project, run step 4 against its session pooler URL, run step 5 with its Storage S3 endpoint and keys, then update the app's environment variables in Vercel and the GitHub secrets.

The restore was tested on 2026-10-11 against a dump of the local database, restored into a throwaway container of the Supabase Postgres image prepared like a freshly started stack: tables, rows, row-level security, and policies came back.
