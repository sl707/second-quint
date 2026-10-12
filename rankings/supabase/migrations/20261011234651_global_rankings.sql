-- Ready-made global rankings, written by the ranking refresher every 5 minutes so ranking pages
-- only read stored rows. Each refresh stores a new list per scope and drops the older ones.

create table public.ranking_lists (
  id bigint generated always as identity primary key,
  -- null = the Overall Ranking
  category_id uuid references public.categories (id) on delete cascade,
  rated boolean not null,
  refreshed_at timestamptz not null
);

create index ranking_lists_scope_idx on public.ranking_lists (category_id, rated, refreshed_at desc);

create table public.ranking_entries (
  list_id bigint not null references public.ranking_lists (id) on delete cascade,
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  -- 1-based place by score among judged contestants; not-yet-judged contestants follow in name order
  position integer not null,
  judged boolean not null,
  rating double precision,
  range double precision,
  score double precision,
  wins integer,
  losses integer,
  matches integer,
  primary key (list_id, contestant_id),
  check (judged = (score is not null))
);

create index ranking_entries_position_idx on public.ranking_entries (list_id, position);

alter table public.ranking_lists enable row level security;
alter table public.ranking_entries enable row level security;

create policy "ranking lists are public" on public.ranking_lists for select using (true);
create policy "ranking entries are public" on public.ranking_entries for select using (true);

-- Stores one scope's freshly computed list and drops that scope's older lists, in one transaction.
-- Contestants or categories deleted while the refresh was computing are skipped.
create function public.store_ranking_list(
  p_category_id uuid,
  p_rated boolean,
  p_refreshed_at timestamptz,
  p_entries jsonb
) returns void
language plpgsql
set search_path = ''
as $$
declare
  new_list_id bigint;
begin
  if p_category_id is not null and not exists (select 1 from public.categories where id = p_category_id) then
    return;
  end if;

  insert into public.ranking_lists (category_id, rated, refreshed_at)
  values (p_category_id, p_rated, p_refreshed_at)
  returning id into new_list_id;

  insert into public.ranking_entries (list_id, contestant_id, position, judged, rating, range, score, wins, losses, matches)
  select new_list_id, e.contestant_id, e.position, e.judged, e.rating, e.range, e.score, e.wins, e.losses, e.matches
  from jsonb_to_recordset(p_entries) as e (
    contestant_id uuid, position integer, judged boolean, rating double precision, range double precision,
    score double precision, wins integer, losses integer, matches integer
  )
  where exists (select 1 from public.contestants c where c.id = e.contestant_id);

  delete from public.ranking_lists
  where category_id is not distinct from p_category_id
    and rated = p_rated
    and id <> (
      select id from public.ranking_lists
      where category_id is not distinct from p_category_id and rated = p_rated
      order by refreshed_at desc, id desc
      limit 1
    );
end;
$$;

revoke execute on function public.store_ranking_list(uuid, boolean, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.store_ranking_list(uuid, boolean, timestamptz, jsonb) to service_role;
