#!/usr/bin/env bash
# Weekly backup to Cloudflare R2. Layout in the bucket:
#   db/YYYY-MM-DD/{roles,schema,data}.sql.gz   one database dump per run, newest 8 kept
#   pictures/current/<storage bucket>/...      mirror of Supabase Storage as of the last run
#   pictures/replaced/YYYY-MM-DD/...           files that run deleted or overwritten, newest 8 kept
# So the database and any picture can be recovered as it was at any of the last 8 runs.
# Needs the variables listed in rclone-env.sh plus SUPABASE_DB_URL and R2_BUCKET,
# and the Supabase CLI, Docker and rclone on PATH.
set -euo pipefail

: "${R2_BUCKET:?R2_BUCKET is required}"
keep=8
today="$(date -u +%F)"
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# shellcheck source=rclone-env.sh
source "$here/rclone-env.sh"

echo "== dumping database"
"$here/db-dump.sh" "$work/db"
gzip -9 "$work"/db/*.sql
rclone copy "$work/db" "r2:$R2_BUCKET/db/$today"

echo "== syncing pictures"
rclone sync "supabase:" "r2:$R2_BUCKET/pictures/current" \
  --backup-dir "r2:$R2_BUCKET/pictures/replaced/$today" \
  --fast-list --checksum --stats-one-line --stats 0

prune() {
  rclone lsf --dirs-only "r2:$R2_BUCKET/$1/" | sort -r | tail -n +$((keep + 1)) |
    while read -r dir; do
      echo "pruning $1/$dir"
      rclone purge "r2:$R2_BUCKET/$1/$dir"
    done
}
echo "== pruning to the newest $keep"
prune db
prune pictures/replaced

echo "== backups now in r2:$R2_BUCKET"
rclone lsf --dirs-only "r2:$R2_BUCKET/db/"
