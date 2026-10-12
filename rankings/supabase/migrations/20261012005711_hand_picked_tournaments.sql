-- Hand-picked tournaments: start_tournament gains p_hand_picked, stored on the tournament. A
-- hand-picked tournament is never rated and never touches allowance_use (unrated_reason
-- 'hand-picked'), whatever p_try_rated says.

drop function public.start_tournament(uuid, uuid, uuid, integer, jsonb, boolean, boolean, date, integer);

create function public.start_tournament(
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
  if p_hand_picked then
    reason := 'hand-picked';
  elsif p_try_rated then
    perform 1 from public.players where id = p_player_id for update;
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

revoke execute on function public.start_tournament(uuid, uuid, uuid, integer, jsonb, boolean, boolean, date, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.start_tournament(uuid, uuid, uuid, integer, jsonb, boolean, boolean, date, integer, boolean)
  to service_role;
