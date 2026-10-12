-- Bans end play: banning a player gives up their unfinished tournaments (played matches stay, no
-- allowance is returned), and every play SQL function refuses a banned player while holding their
-- row, so a pick or start racing a ban either lands before it (and is then excluded with the
-- player's other matches, if the ban removes them) or is refused.

-- Locks the signed-in player's row for the rest of the transaction, so their plays take turns with
-- each other and with set_player_ban and delete_player_account, and raises 'player_banned' if they
-- are banned. Does nothing for a signed-out visitor (null).
create function private.lock_player_for_play(p_player_id uuid) returns void
language plpgsql
set search_path = ''
as $$
declare
  is_banned boolean;
begin
  if p_player_id is null then
    return;
  end if;
  select p.banned into is_banned from public.players p where p.id = p_player_id for update;
  if is_banned then
    raise exception 'player_banned';
  end if;
end;
$$;

revoke execute on function private.lock_player_for_play(uuid) from public, anon, authenticated;
grant execute on function private.lock_player_for_play(uuid) to service_role;

-- Banning also ends the player's unfinished tournaments as given up; unbanning doesn't reopen them.
create or replace function public.set_player_ban(p_player_id uuid, p_banned boolean, p_exclude_matches boolean) returns boolean
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
  if p_banned then
    update public.tournaments set status = 'given_up', can_undo = false, finished_at = now()
    where player_id = p_player_id and status = 'in_progress';
  end if;
  return true;
end;
$$;

create or replace function public.start_tournament(
  p_player_id uuid,
  p_visitor_id uuid,
  p_category_id uuid,
  p_size integer,
  p_bracket jsonb,
  p_try_rated boolean,
  p_require_rated boolean,
  p_day date,
  p_allowance integer,
  p_hand_picked boolean
) returns table (tournament_id uuid, rated boolean, unrated_reason text)
language plpgsql
set search_path = ''
as $$
declare
  is_rated boolean := false;
  reason text;
  new_id uuid;
begin
  perform private.lock_player_for_play(p_player_id);

  if p_hand_picked then
    reason := 'hand-picked';
  elsif p_try_rated then
    if exists (
      select 1 from public.tournaments t
      where t.player_id = p_player_id and t.rated and t.status = 'in_progress'
    ) then
      reason := 'unfinished-rated-tournament';
    else
      insert into public.allowance_use (player_id, category_id, day)
      values (p_player_id, p_category_id, p_day)
      on conflict on constraint allowance_use_key do nothing;

      update public.allowance_use a set used = a.used + p_size
      where a.player_id = p_player_id
        and a.category_id is not distinct from p_category_id
        and a.day = p_day
        and a.used + p_size <= p_allowance;
      if found then
        is_rated := true;
      else
        reason := 'not-enough-allowance';
      end if;
    end if;
  end if;

  if p_require_rated and not is_rated then
    return query select null::uuid, false, reason;
    return;
  end if;

  insert into public.tournaments (player_id, visitor_id, category_id, size, bracket, rated, hand_picked, reserved_allowance, allowance_day)
  values (
    p_player_id, p_visitor_id, p_category_id, p_size, p_bracket, is_rated, p_hand_picked,
    case when is_rated then p_size else 0 end,
    case when is_rated then p_day end
  )
  returning id into new_id;

  return query select new_id, is_rated, reason;
end;
$$;

-- Records the person's pick for match p_bracket_match of their unfinished tournament, finishing the
-- tournament when p_finishes, and lets it be undone. The match takes the tournament's scope and
-- rated flag. Outcome: 'picked', 'gone' (not theirs or no longer unfinished), or 'taken' (that match
-- was already picked).
create function public.pick_tournament_match(
  p_tournament_id uuid,
  p_player_id uuid,
  p_visitor_id uuid,
  p_bracket_match integer,
  p_round integer,
  p_winner_id uuid,
  p_loser_id uuid,
  p_finishes boolean
) returns text
language plpgsql
set search_path = ''
as $$
declare
  t public.tournaments;
begin
  perform private.lock_player_for_play(p_player_id);

  select * into t from public.tournaments
  where id = p_tournament_id
    and player_id is not distinct from p_player_id
    and visitor_id is not distinct from p_visitor_id
    and status = 'in_progress'
  for update;
  if t.id is null then
    return 'gone';
  end if;

  begin
    insert into public.matches (winner_id, loser_id, category_id, player_id, visitor_id, rated, tournament_id, round, bracket_match)
    values (p_winner_id, p_loser_id, t.category_id, p_player_id, p_visitor_id, t.rated, t.id, p_round, p_bracket_match);
  exception when unique_violation then
    return 'taken';
  end;

  update public.tournaments
  set can_undo = true,
      status = case when p_finishes then 'finished' else 'in_progress' end,
      finished_at = case when p_finishes then now() end
  where id = t.id;
  return 'picked';
end;
$$;

revoke execute on function public.pick_tournament_match(uuid, uuid, uuid, integer, integer, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.pick_tournament_match(uuid, uuid, uuid, integer, integer, uuid, uuid, boolean)
  to service_role;

create or replace function public.pick_infinite_pair(
  p_pair_id uuid,
  p_player_id uuid,
  p_visitor_id uuid,
  p_winner_id uuid,
  p_day date,
  p_allowance integer
) returns table (claimed boolean, rated boolean)
language plpgsql
set search_path = ''
as $$
declare
  pair public.infinite_pairs;
  is_rated boolean := false;
begin
  perform private.lock_player_for_play(p_player_id);

  delete from public.infinite_pairs p
  where p.id = p_pair_id
    and p.player_id is not distinct from p_player_id
    and p.visitor_id is not distinct from p_visitor_id
    and p_winner_id in (p.first_contestant_id, p.second_contestant_id)
  returning * into pair;
  if pair.id is null then
    return query select false, false;
    return;
  end if;

  if p_player_id is not null and not pair.chose_unrated then
    insert into public.allowance_use (player_id, category_id, day)
    values (p_player_id, pair.category_id, p_day)
    on conflict on constraint allowance_use_key do nothing;

    update public.allowance_use a set used = a.used + 1
    where a.player_id = p_player_id
      and a.category_id is not distinct from pair.category_id
      and a.day = p_day
      and a.used + 1 <= p_allowance;
    is_rated := found;
  end if;

  insert into public.matches (winner_id, loser_id, category_id, player_id, visitor_id, rated)
  values (
    p_winner_id,
    case when p_winner_id = pair.first_contestant_id then pair.second_contestant_id else pair.first_contestant_id end,
    pair.category_id, p_player_id, p_visitor_id, is_rated
  );

  return query select true, is_rated;
end;
$$;

create or replace function public.skip_infinite_pair(
  p_pair_id uuid,
  p_player_id uuid,
  p_visitor_id uuid,
  p_day date,
  p_allowance integer,
  p_skip_limit integer
) returns table (outcome text, rated boolean)
language plpgsql
set search_path = ''
as $$
declare
  pair public.infinite_pairs;
  is_rated boolean := false;
begin
  perform private.lock_player_for_play(p_player_id);

  select * into pair from public.infinite_pairs p
  where p.id = p_pair_id
    and p.player_id is not distinct from p_player_id
    and p.visitor_id is not distinct from p_visitor_id
  for update;
  if pair.id is null then
    return query select 'gone', false;
    return;
  end if;

  if p_player_id is not null and not pair.chose_unrated then
    is_rated := coalesce((
      select a.used from public.allowance_use a
      where a.player_id = p_player_id and a.category_id is not distinct from pair.category_id and a.day = p_day
    ), 0) < p_allowance;
  end if;

  if is_rated then
    insert into public.skip_use (player_id, day) values (p_player_id, p_day)
    on conflict (player_id, day) do nothing;

    update public.skip_use s set used = s.used + 1
    where s.player_id = p_player_id and s.day = p_day and s.used + 1 <= p_skip_limit;
    if not found then
      return query select 'out-of-skips', true;
      return;
    end if;
  end if;

  delete from public.infinite_pairs where id = pair.id;
  return query select 'skipped', is_rated;
end;
$$;
