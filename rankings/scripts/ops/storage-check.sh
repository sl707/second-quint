#!/usr/bin/env bash
# Measures database size and file storage against the Supabase free limits and, when either
# passes 80%, opens (or updates) a GitHub issue labelled storage-alert so the owner is notified.
# Egress isn't exposed by the Supabase Management API, so it isn't measured here (see docs/ops.md).
# Needs: SUPABASE_DB_URL, psql. For the issue: gh, GH_TOKEN, GITHUB_REPOSITORY.
# DRY_RUN=1 prints the report without touching GitHub.
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
label=storage-alert
threshold_pct=80
db_limit=$((500 * 1000 * 1000))
files_limit=$((1000 * 1000 * 1000))

IFS='|' read -r db_bytes files_bytes < <(psql "$SUPABASE_DB_URL" -Atc "
  select pg_database_size(current_database()),
         coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0)")

pct() { echo $(($1 * 100 / $2)); }
mb() { awk -v b="$1" 'BEGIN { printf "%.1f MB", b / 1000000 }'; }
db_pct=$(pct "$db_bytes" "$db_limit")
files_pct=$(pct "$files_bytes" "$files_limit")

over=()
[ "$db_pct" -ge "$threshold_pct" ] && over+=(database)
[ "$files_pct" -ge "$threshold_pct" ] && over+=(files)
over_list="${over[*]:-none}"

report="| Resource | Used | Free limit | Used % |
| --- | --- | --- | --- |
| Database | $(mb "$db_bytes") | 500 MB | ${db_pct}% |
| File storage | $(mb "$files_bytes") | 1000 MB | ${files_pct}% |
| Egress | not measured | 5 GB / month | check the Supabase usage page |

Over ${threshold_pct}%: **${over_list}**. Measured $(date -u '+%F %H:%M UTC')."

echo "$report"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "$report" >> "$GITHUB_STEP_SUMMARY"

if [ "${#over[@]}" -eq 0 ] || [ -n "${DRY_RUN:-}" ]; then
  exit 0
fi

body="Supabase usage passed ${threshold_pct}% of a free-plan limit. See \`rankings/docs/ops.md\` (Storage alert) for what to do.

$report

<!-- over: ${over_list} -->"

gh label create "$label" --color D93F0B --description "Supabase usage near free limits" --force >/dev/null
issue=$(gh issue list --label "$label" --state open --json number --jq '.[0].number // empty')

if [ -z "$issue" ]; then
  gh issue create --title "Supabase storage above ${threshold_pct}% of the free limit" --label "$label" --body "$body"
  exit 0
fi

previous=$(gh issue view "$issue" --json body --jq .body | sed -n 's/^<!-- over: \(.*\) -->$/\1/p')
gh issue edit "$issue" --body "$body" >/dev/null
echo "Updated issue #$issue"
# Editing doesn't notify; comment only when a different resource crosses the line.
if [ "$previous" != "$over_list" ]; then
  gh issue comment "$issue" --body "Now over ${threshold_pct}%: **${over_list}** (was: ${previous:-unknown})."
fi
