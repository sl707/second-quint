-- The only admin can't delete their account, so the site is never left without one. Raises
-- 'only_admin' instead; another admin (not banned) must exist first.
create or replace function public.delete_player_account(p_player_id uuid) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  tombstone constant uuid := '00000000-0000-0000-0000-000000000000';
  deleted_user uuid;
  was_banned boolean;
begin
  if exists (select 1 from public.players where id = p_player_id and is_admin and not banned) then
    -- Locks every admin in one order, so two admins deleting at once can't both see the other.
    perform 1 from public.players where is_admin order by id for update;
    if not exists (
      select 1 from public.players where is_admin and not banned and user_id is not null and id <> p_player_id
    ) then
      raise exception 'only_admin';
    end if;
  end if;

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
