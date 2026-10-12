-- The contestant page: head-to-head records in either ranking version, and weekly snapshots of
-- global rated ratings for its rating-over-time chart.

-- Head-to-head reads every match a contestant played, rated or not, so the indexes can't be
-- partial. They also serve the "has it had a rated match yet?" edit check.
drop index public.matches_rated_winner_idx;
drop index public.matches_rated_loser_idx;
create index matches_winner_idx on public.matches (winner_id);
create index matches_loser_idx on public.matches (loser_id);

-- Wins and losses against each opponent, from counted matches (only rated ones when p_rated),
-- most matches first, then by opponent name.
create function public.contestant_head_to_head(p_contestant_id uuid, p_rated boolean)
returns table (opponent_id uuid, wins integer, losses integer)
language sql
stable
set search_path = ''
as $$
  select m.opponent_id, (count(*) filter (where m.won))::integer, (count(*) filter (where not m.won))::integer
  from (
    select loser_id as opponent_id, true as won
    from public.matches
    where winner_id = p_contestant_id and not excluded and (rated or not p_rated)
    union all
    select winner_id, false
    from public.matches
    where loser_id = p_contestant_id and not excluded and (rated or not p_rated)
  ) m
  join public.contestants c on c.id = m.opponent_id
  group by m.opponent_id, c.name
  order by count(*) desc, c.name, m.opponent_id
$$;

grant execute on function public.contestant_head_to_head(uuid, boolean) to anon, authenticated, service_role;

-- At most one snapshot per scope per New York week (named by its Monday), taken by the ranking
-- refresher from the rated list it just computed. Only judged contestants get an entry. Kept
-- small (real, no extra indexes) to protect the free 500 MB database.
create table public.rating_snapshots (
  id bigint generated always as identity primary key,
  -- null = the Overall Ranking
  category_id uuid references public.categories (id) on delete cascade,
  week date not null,
  taken_at timestamptz not null,
  unique nulls not distinct (category_id, week)
);

create table public.rating_snapshot_entries (
  snapshot_id bigint not null references public.rating_snapshots (id) on delete cascade,
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  rating real not null,
  range real not null,
  primary key (contestant_id, snapshot_id)
);

alter table public.rating_snapshots enable row level security;
alter table public.rating_snapshot_entries enable row level security;

create policy "rating snapshots are public" on public.rating_snapshots for select using (true);
create policy "rating snapshot entries are public" on public.rating_snapshot_entries for select using (true);

-- Stores a scope's snapshot for the week unless it already has one. Returns whether it stored it.
create function public.store_rating_snapshot(
  p_category_id uuid,
  p_week date,
  p_taken_at timestamptz,
  p_entries jsonb
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  new_snapshot_id bigint;
begin
  if p_category_id is not null and not exists (select 1 from public.categories where id = p_category_id) then
    return false;
  end if;

  insert into public.rating_snapshots (category_id, week, taken_at)
  values (p_category_id, p_week, p_taken_at)
  on conflict (category_id, week) do nothing
  returning id into new_snapshot_id;
  if new_snapshot_id is null then
    return false;
  end if;

  insert into public.rating_snapshot_entries (snapshot_id, contestant_id, rating, range)
  select new_snapshot_id, e.contestant_id, e.rating, e.range
  from jsonb_to_recordset(p_entries) as e (contestant_id uuid, rating real, range real)
  where exists (select 1 from public.contestants c where c.id = e.contestant_id);
  return true;
end;
$$;

revoke execute on function public.store_rating_snapshot(uuid, date, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.store_rating_snapshot(uuid, date, timestamptz, jsonb) to service_role;
