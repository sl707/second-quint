#!/usr/bin/env bash
# Dumps a Supabase database as roles.sql, schema.sql and data.sql into OUT_DIR.
# Usage: SUPABASE_DB_URL=postgresql://... db-dump.sh OUT_DIR
# Needs the Supabase CLI (or SUPABASE_CLI pointing at it) and Docker: the CLI runs
# pg_dump inside the Supabase Postgres image and strips Supabase-managed internals.
set -euo pipefail

out_dir="${1:?usage: db-dump.sh OUT_DIR}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
supabase="${SUPABASE_CLI:-supabase}"

mkdir -p "$out_dir"
"$supabase" db dump --db-url "$SUPABASE_DB_URL" -f "$out_dir/roles.sql" --role-only
"$supabase" db dump --db-url "$SUPABASE_DB_URL" -f "$out_dir/schema.sql"
"$supabase" db dump --db-url "$SUPABASE_DB_URL" -f "$out_dir/data.sql" --use-copy --data-only \
  -x storage.buckets_vectors -x storage.vector_indexes

ls -l "$out_dir"
