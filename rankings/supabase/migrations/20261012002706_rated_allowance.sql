-- Rated allowance: how many rated matches each player has used per scope per allowance day
-- (midnight to midnight in New York). Rated tournaments add all their matches when they start;
-- rated Infinite Mode picks will add one at a time. Nothing is ever subtracted.

create table public.allowance_use (
  player_id uuid not null references public.players (id) on delete cascade,
  -- null scope = all contestants
  category_id uuid references public.categories (id) on delete cascade,
  day date not null,
  used integer not null default 0 check (used >= 0),
  constraint allowance_use_key unique nulls not distinct (player_id, category_id, day)
);

-- Private to the server-side game service, which uses the admin client.
alter table public.allowance_use enable row level security;

-- One unfinished rated tournament per player, across all scopes.
create unique index tournaments_one_unfinished_rated_idx on public.tournaments (player_id)
  where rated and status = 'in_progress';

-- Starts a tournament, rated when p_try_rated and the player has no unfinished rated tournament and
-- p_size matches fit in what's left of p_allowance for the scope on p_day; a rated tournament
-- reserves all p_size matches. Locking the player's row makes concurrent starts take turns.
-- With p_require_rated, a tournament that can't be rated isn't created (tournament_id is null).
-- unrated_reason is 'unfinished-rated-tournament' or 'not-enough-allowance' when those checks fail.
create function public.start_tournament(
  p_player_id uuid,
  p_visitor_id uuid,
  p_category_id uuid,
  p_size integer,
  p_bracket jsonb,
  p_try_rated boolean,
  p_require_rated boolean,
  p_day date,
  p_allowance integer
) returns table (tournament_id uuid, rated boolean, unrated_reason text)
language plpgsql
set search_path = ''
as $$
declare
  is_rated boolean := false;
  reason text;
  new_id uuid;
begin
  if p_try_rated then
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

  insert into public.tournaments (player_id, visitor_id, category_id, size, bracket, rated, reserved_allowance, allowance_day)
  values (
    p_player_id, p_visitor_id, p_category_id, p_size, p_bracket, is_rated,
    case when is_rated then p_size else 0 end,
    case when is_rated then p_day end
  )
  returning id into new_id;

  return query select new_id, is_rated, reason;
end;
$$;

revoke execute on function public.start_tournament(uuid, uuid, uuid, integer, jsonb, boolean, boolean, date, integer)
  from public, anon, authenticated;
grant execute on function public.start_tournament(uuid, uuid, uuid, integer, jsonb, boolean, boolean, date, integer)
  to service_role;
