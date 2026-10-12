-- Account deletion: a player deletes their account. Everything personal goes (the player row with
-- its display name, tournaments, allowance and skip use, offered Infinite Mode pairs); their matches
-- and catalog contributions stay, re-pointed to one shared anonymous tombstone player. The server
-- deletes the auth user (and so the email) after this succeeds.

-- The tombstone is the only player with no auth user and no display name, so it has no profile.
alter table public.players alter column user_id drop not null, alter column display_name drop not null;
alter table public.players add constraint players_tombstone_check check (
  (user_id is null) = (display_name is null)
  and (user_id is null) = (id = '00000000-0000-0000-0000-000000000000')
);

insert into public.players (id, user_id, display_name, created_at)
values ('00000000-0000-0000-0000-000000000000', null, null, '2026-01-01');

-- Returns the deleted player's auth user ID, or null when there's no such player.
create function public.delete_player_account(p_player_id uuid) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  tombstone constant uuid := '00000000-0000-0000-0000-000000000000';
  deleted_user uuid;
begin
  -- Locks the row like start_tournament and pick_infinite_pair, so no play lands halfway through.
  select user_id into deleted_user from public.players where id = p_player_id and user_id is not null for update;
  if deleted_user is null then
    return null;
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

revoke execute on function public.delete_player_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_player_account(uuid) to service_role;

-- The tombstone can't be banned: it holds every deleted player's matches.
create or replace function public.set_player_ban(p_player_id uuid, p_banned boolean, p_exclude_matches boolean) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.players set banned = p_banned where id = p_player_id and user_id is not null;
  if not found then
    return false;
  end if;
  update public.matches set excluded = p_exclude_matches
  where player_id = p_player_id and excluded <> p_exclude_matches;
  return true;
end;
$$;
