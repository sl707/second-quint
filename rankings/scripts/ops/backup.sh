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

prune() {
  rclone lsf --dirs-only "r2:$R2_BUCKET/$1/" | sort -r | tail -n +"$2" |
    while read -r dir; do
      echo "pruning $1/$dir"
      rclone purge "r2:$R2_BUCKET/$1/$dir"
    done
}
echo "== pruning to make room for this run (keeping the newest $((keep - 1)))"
prune db "$keep"
prune pictures/replaced "$keep"

echo "== dumping database"
"$here/db-dump.sh" "$work/db"
gzip -9 "$work"/db/*.sql

# Spend guardrail. R2 has no spending cap, and this job is the only writer to the bucket,
# so it refuses to run if the bucket could leave the free tier (10 GB storage,
# 1M Class A operations a month). Worst case counted: every picture re-uploaded.
max_bytes=$((8 * 1024 * 1024 * 1024))
max_files=100000
bytes_of() { rclone size "$1" --json | sed -E 's/.*"bytes":([0-9]+).*/\1/'; }
count_of() { rclone size "$1" --json | sed -E 's/.*"count":([0-9]+).*/\1/'; }
bucket_bytes="$(bytes_of "r2:$R2_BUCKET")"
dump_bytes="$(du -sk "$work/db" | cut -f1)"; dump_bytes=$((dump_bytes * 1024))
picture_bytes="$(bytes_of "supabase:")"
picture_files="$(count_of "supabase:")"
projected=$((bucket_bytes + dump_bytes + picture_bytes))
echo "== guardrail: bucket ${bucket_bytes}B + dump ${dump_bytes}B + pictures ${picture_bytes}B = ${projected}B (limit ${max_bytes}B); ${picture_files} pictures (limit ${max_files})"
if (( projected > max_bytes || picture_files > max_files )); then
  echo "::error::Backup refused: it could take R2 past 80% of the free tier. Nothing was uploaded." >&2
  exit 3
fi

rclone copy "$work/db" "r2:$R2_BUCKET/db/$today"

echo "== syncing pictures"
rclone sync "supabase:" "r2:$R2_BUCKET/pictures/current" \
  --backup-dir "r2:$R2_BUCKET/pictures/replaced/$today" \
  --fast-list --checksum --stats-one-line --stats 0

echo "== backups now in r2:$R2_BUCKET"
rclone lsf --dirs-only "r2:$R2_BUCKET/db/"
