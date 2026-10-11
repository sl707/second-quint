#!/usr/bin/env bash
# Restores roles.sql, schema.sql and data.sql (from db-dump.sh) into a freshly started,
# empty Supabase database (no app migrations applied).
# Usage: db-restore.sh DUMP_DIR TARGET_DB_URL
set -euo pipefail

dump_dir="${1:?usage: db-restore.sh DUMP_DIR TARGET_DB_URL}"
target="${2:?usage: db-restore.sh DUMP_DIR TARGET_DB_URL}"

# Role settings are best-effort: Supabase's own roles already exist in a fresh stack, and
# some grants in the dump (e.g. GRANT SET ON PARAMETER to service roles) can only be
# replayed by supabase_admin. Errors here are printed but don't stop the restore.
echo "== roles (errors on Supabase-managed roles are expected and harmless)"
psql --quiet --file "$dump_dir/roles.sql" --dbname "$target" || true

# Schema and data are all-or-nothing: one transaction, stop at the first error.
# replica mode skips triggers so restored rows aren't re-processed (e.g. double-encrypted).
echo "== schema and data"
psql \
  --quiet \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$dump_dir/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$dump_dir/data.sql" \
  --dbname "$target"
echo "== restore finished"
