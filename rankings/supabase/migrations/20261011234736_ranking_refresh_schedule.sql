-- Every 5 minutes, pg_cron asks the app's ranking refresher (POST /api/rankings/refresh) to
-- recompute the global rankings. The URL and shared secret live in Supabase Vault:
--
--   select vault.create_secret('https://rankings.secondquint.com/api/rankings/refresh', 'rankings_refresh_url');
--   select vault.create_secret('<same value as RANKINGS_REFRESH_SECRET>', 'rankings_refresh_secret');
--
-- Until both are set (as locally), the scheduled call does nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;

create function private.request_ranking_refresh() returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  refresh_url text;
  refresh_secret text;
begin
  select decrypted_secret into refresh_url from vault.decrypted_secrets where name = 'rankings_refresh_url';
  select decrypted_secret into refresh_secret from vault.decrypted_secrets where name = 'rankings_refresh_secret';
  if refresh_url is null or refresh_secret is null then
    return null;
  end if;

  return net.http_post(
    url := refresh_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || refresh_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function private.request_ranking_refresh() from public, anon, authenticated;

select cron.schedule('refresh-global-rankings', '*/5 * * * *', 'select private.request_ranking_refresh()');
