-- Banning players: the admin sets or clears a player's ban, and flags all their matches as excluded
-- from rankings or restores them, in one transaction. Matches are never deleted, so a ban can be
-- reversed. Rankings take the change in at the next refresh.

-- Returns false when the player doesn't exist.
create function public.set_player_ban(p_player_id uuid, p_banned boolean, p_exclude_matches boolean) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.players set banned = p_banned where id = p_player_id;
  if not found then
    return false;
  end if;
  update public.matches set excluded = p_exclude_matches
  where player_id = p_player_id and excluded <> p_exclude_matches;
  return true;
end;
$$;

revoke execute on function public.set_player_ban(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.set_player_ban(uuid, boolean, boolean) to service_role;
