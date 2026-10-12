-- Signed-out play protection: a visitor's picks are accepted only after they pass Cloudflare
-- Turnstile, which is remembered until verified_until, and at most p_limit per p_window per visitor
-- and per IP.

create table public.visitor_verifications (
  visitor_id uuid primary key,
  verified_until timestamptz not null
);
create index visitor_verifications_expiry on public.visitor_verifications (verified_until);
alter table public.visitor_verifications enable row level security;
revoke all on public.visitor_verifications from anon, authenticated;

-- One row per accepted signed-out pick, kept only for the rate-limit window.
create table public.signed_out_picks (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  ip inet,
  picked_at timestamptz not null
);
create index signed_out_picks_visitor on public.signed_out_picks (visitor_id, picked_at);
create index signed_out_picks_ip on public.signed_out_picks (ip, picked_at) where ip is not null;
create index signed_out_picks_age on public.signed_out_picks (picked_at);
alter table public.signed_out_picks enable row level security;
revoke all on public.signed_out_picks from anon, authenticated;

-- Lets one signed-out pick through if the visitor has a passed human check and both the visitor
-- and p_ip (null when unknown) have fewer than p_limit picks in the p_window before p_now,
-- recording it. Outcome: 'ok', 'unverified', or 'too-fast'. Locking on the visitor, then the IP,
-- makes concurrent picks sharing either take turns; rows older than the window are pruned on every
-- call so the table stays small.
create function public.claim_signed_out_pick(
  p_visitor_id uuid,
  p_ip inet,
  p_now timestamptz,
  p_limit integer,
  p_window interval
) returns text
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.visitor_verifications v
    where v.visitor_id = p_visitor_id and v.verified_until > p_now
  ) then
    return 'unverified';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('signed_out_pick:visitor:' || p_visitor_id::text, 0));
  if p_ip is not null then
    perform pg_advisory_xact_lock(hashtextextended('signed_out_pick:ip:' || host(p_ip), 0));
  end if;

  delete from public.signed_out_picks where picked_at <= p_now - p_window;

  if (select count(*) from public.signed_out_picks s
      where s.visitor_id = p_visitor_id and s.picked_at > p_now - p_window) >= p_limit then
    return 'too-fast';
  end if;
  if p_ip is not null and (select count(*) from public.signed_out_picks s
      where s.ip = p_ip and s.picked_at > p_now - p_window) >= p_limit then
    return 'too-fast';
  end if;

  insert into public.signed_out_picks (visitor_id, ip, picked_at) values (p_visitor_id, p_ip, p_now);
  return 'ok';
end;
$$;

revoke execute on function public.claim_signed_out_pick(uuid, inet, timestamptz, integer, interval) from public, anon, authenticated;
grant execute on function public.claim_signed_out_pick(uuid, inet, timestamptz, integer, interval) to service_role;
