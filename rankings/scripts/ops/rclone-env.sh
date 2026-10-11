# shellcheck shell=bash
# Source this to configure two rclone remotes from environment variables (no config file):
#   supabase:  the project's Storage, through its S3-compatible endpoint
#   r2:        the Cloudflare R2 account holding the backups
# Needs: SUPABASE_PROJECT_REF SUPABASE_S3_REGION SUPABASE_S3_ACCESS_KEY_ID SUPABASE_S3_SECRET_ACCESS_KEY
#        R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY

export RCLONE_CONFIG_SUPABASE_TYPE=s3
export RCLONE_CONFIG_SUPABASE_PROVIDER=Other
export RCLONE_CONFIG_SUPABASE_ENDPOINT="https://${SUPABASE_PROJECT_REF:?}.storage.supabase.co/storage/v1/s3"
export RCLONE_CONFIG_SUPABASE_REGION="${SUPABASE_S3_REGION:?}"
export RCLONE_CONFIG_SUPABASE_ACCESS_KEY_ID="${SUPABASE_S3_ACCESS_KEY_ID:?}"
export RCLONE_CONFIG_SUPABASE_SECRET_ACCESS_KEY="${SUPABASE_S3_SECRET_ACCESS_KEY:?}"
export RCLONE_CONFIG_SUPABASE_FORCE_PATH_STYLE=true

export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID:?}.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_REGION=auto
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:?}"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:?}"
# A bucket-scoped R2 token can't list or create buckets.
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
