-- Rated Infinite Mode: a signed-in player's pick is rated while they have allowance left in the
-- scope, and uses one allowance, unless they chose to play unrated.

-- A player who chose unrated is offered a separate pair, so skipping freely while unrated can't
-- clear the pair they're offered while rated.
alter table public.infinite_pairs add column chose_unrated boolean not null default false;
alter table public.infinite_pairs drop constraint infinite_pairs_owner_scope_key;
alter table public.infinite_pairs add constraint infinite_pairs_owner_scope_key
  unique nulls not distinct (player_id, visitor_id, category_id, chose_unrated);

-- Picks the winner of the person's offered pair: takes the pair off the table, records the match,
-- and makes it rated when it's a signed-in player's pair, they didn't choose unrated, and one more
-- rated match fits in p_allowance for the scope on p_day, adding it to allowance_use. Locking the player's row makes concurrent picks (and
-- start_tournament) take turns. claimed is false when the pair was already picked or skipped.
create function public.pick_infinite_pair(
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
    perform 1 from public.players where id = p_player_id for update;

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

revoke execute on function public.pick_infinite_pair(uuid, uuid, uuid, uuid, date, integer)
  from public, anon, authenticated;
grant execute on function public.pick_infinite_pair(uuid, uuid, uuid, uuid, date, integer)
  to service_role;

-- Rated skips each player has used per allowance day, across all Infinite Mode. Nothing is ever
-- subtracted.
create table public.skip_use (
  player_id uuid not null references public.players (id) on delete cascade,
  day date not null,
  used integer not null default 0 check (used >= 0),
  primary key (player_id, day)
);

-- Private to the server-side game service, which uses the admin client.
alter table public.skip_use enable row level security;

-- Skips the person's offered pair. While it would be a rated pick (a signed-in player's pair, they
-- didn't choose unrated, and allowance is left in the scope on p_day), the skip is rated and uses
-- one of p_skip_limit for p_day; with none left the pair stays offered. Locking the player's row
-- makes concurrent skips and picks take turns.
-- outcome is 'skipped', 'gone' (already picked or skipped), or 'out-of-skips'.
create function public.skip_infinite_pair(
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
    perform 1 from public.players where id = p_player_id for update;
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

revoke execute on function public.skip_infinite_pair(uuid, uuid, uuid, date, integer, integer)
  from public, anon, authenticated;
grant execute on function public.skip_infinite_pair(uuid, uuid, uuid, date, integer, integer)
  to service_role;
