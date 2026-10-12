-- Banned identities: when a banned player deletes their account, one-way hashes of their sign-in
-- identity (auth user ID, each provider identity such as their Google account ID, and email) are
-- kept, so the same sign-in can't become a player again. The hashes can't be turned back into
-- an account, so the ban can't be lifted after deletion.
create table public.banned_identities (
  identity_hash text primary key,
  banned_at timestamptz not null default now()
);

alter table public.banned_identities enable row level security;
revoke all on public.banned_identities from anon, authenticated;

-- Reads Supabase Auth's tables, which only the owner can; never callable from the browser.
create function private.identity_hashes(p_user_id uuid) returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(pg_catalog.sha256(pg_catalog.convert_to(k, 'UTF8')), 'hex')
  from (
    select 'user:' || p_user_id::text
    union
    select 'email:' || lower(u.email) from auth.users u where u.id = p_user_id and u.email is not null
    union
    select 'identity:' || i.provider || ':' || i.provider_id from auth.identities i where i.user_id = p_user_id
    union
    select 'email:' || i.email from auth.identities i where i.user_id = p_user_id and i.email is not null
  ) keys (k);
$$;

revoke execute on function private.identity_hashes(uuid) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.identity_hashes(uuid) to service_role;

-- Whether a signed-in auth user matches a banned player who deleted their account.
create function public.is_banned_identity(p_user_id uuid) returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.banned_identities b
    where b.identity_hash in (select private.identity_hashes(p_user_id))
  );
$$;

revoke execute on function public.is_banned_identity(uuid) from public, anon, authenticated;
grant execute on function public.is_banned_identity(uuid) to service_role;

-- As before, plus: a banned player's identity hashes are kept before their auth user goes.
create or replace function public.delete_player_account(p_player_id uuid) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  tombstone constant uuid := '00000000-0000-0000-0000-000000000000';
  deleted_user uuid;
  was_banned boolean;
begin
  -- Locks the row like start_tournament and pick_infinite_pair, so no play lands halfway through.
  select user_id, banned into deleted_user, was_banned
  from public.players where id = p_player_id and user_id is not null for update;
  if deleted_user is null then
    return null;
  end if;

  if was_banned then
    insert into public.banned_identities (identity_hash)
    select private.identity_hashes(deleted_user)
    on conflict do nothing;
  end if;

  -- Tournaments are personal, so their matches leave them before they're deleted.
  update public.matches set player_id = tombstone, tournament_id = null, round = null, bracket_match = null
  where player_id = p_player_id;
  delete from public.tournaments where player_id = p_player_id;

  update public.contestants set created_by = tombstone where created_by = p_player_id;
  update public.categories set created_by = tombstone where created_by = p_player_id;
  update public.category_memberships set added_by = tombstone where added_by = p_player_id;

  update public.reports set status = 'resolved', closed_at = now()
  where target_type = 'profile' and target_id = p_player_id and status = 'open';

  -- Cascades to allowance_use, skip_use, and infinite_pairs; their reports lose the reporter.
  delete from public.players where id = p_player_id;
  return deleted_user;
end;
$$;
