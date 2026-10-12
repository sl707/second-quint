-- Reports and catalog moderation: anyone can report a contestant, category, or profile; the admin
-- works through the open reports, removes contestants from categories, and deletes categories.
-- Writes go through the server-side catalog and admin services; the admin-only functions below
-- can only be called with the service role, and only the admin can read reports.

-- A tournament that loses its scope or one of its contestants ends as removed: it can't continue
-- and has no tournament ranking, but its remaining matches still count.
alter table public.tournaments drop constraint tournaments_status_check;
alter table public.tournaments add constraint tournaments_status_check
  check (status in ('in_progress', 'finished', 'given_up', 'removed'));

create table public.reports (
  id bigint generated always as identity primary key,
  -- who reported it: a player, or a signed-out visitor (whose ID is never readable)
  reporter_player_id uuid references public.players (id) on delete set null,
  reporter_visitor_id uuid,
  target_type text not null check (target_type in ('contestant', 'category', 'profile')),
  -- a contestant, category, or player ID, depending on target_type
  target_id uuid not null,
  reason text not null check (length(btrim(reason)) between 1 and 280),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((status = 'open') = (closed_at is null))
);

create index reports_open_idx on public.reports (created_at) where status = 'open';
-- Reporting the same thing again while the first report is open adds nothing.
create unique index reports_one_open_per_reporter_idx
  on public.reports (target_type, target_id, coalesce(reporter_player_id, reporter_visitor_id))
  where status = 'open';

-- Whether the signed-in user is the (unbanned) admin, for row-level security.
create function private.is_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.players where user_id = (select auth.uid()) and is_admin and not banned)
$$;

revoke execute on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.reports enable row level security;
create policy "only the admin reads reports" on public.reports for select to authenticated using ((select private.is_admin()));
revoke all on public.reports from anon, authenticated;
grant select (id, reporter_player_id, target_type, target_id, reason, status, created_at, closed_at)
  on public.reports to authenticated;

-- Deletes a contestant and its own matches. Tournaments that drew it end as removed (their other
-- matches still count), and open reports about it are resolved. Returns the picture URLs no
-- remaining contestant uses, so the caller can remove the files.
create or replace function public.delete_contestant(p_contestant_id uuid) returns text[]
language plpgsql
set search_path = ''
as $$
declare
  pictures text[];
begin
  select array[picture_512_url, picture_128_url] into pictures
  from public.contestants where id = p_contestant_id for update;
  if not found then
    return array[]::text[];
  end if;

  update public.tournaments
  set status = 'removed', can_undo = false, finished_at = coalesce(finished_at, now())
  where bracket -> 'slots' ? p_contestant_id::text and status <> 'removed';
  delete from public.matches where winner_id = p_contestant_id or loser_id = p_contestant_id;
  update public.contestants set merged_into = null where merged_into = p_contestant_id;
  update public.reports set status = 'resolved', closed_at = now()
  where target_type = 'contestant' and target_id = p_contestant_id and status = 'open';
  delete from public.contestants where id = p_contestant_id;

  return array(
    select distinct url from unnest(pictures) as url
    where not exists (
      select 1 from public.contestants c where c.picture_512_url = url or c.picture_128_url = url
    )
  );
end;
$$;

-- Deletes a category with its memberships and rankings. Its matches stay and count toward overall
-- only (their scope becomes all contestants); its unfinished tournaments end as removed.
create function public.delete_category(p_category_id uuid) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.categories where id = p_category_id for update;
  if not found then
    return false;
  end if;

  update public.tournaments
  set status = 'removed', can_undo = false, finished_at = now()
  where category_id = p_category_id and status = 'in_progress';
  update public.reports set status = 'resolved', closed_at = now()
  where target_type = 'category' and target_id = p_category_id and status = 'open';
  delete from public.categories where id = p_category_id;
  return true;
end;
$$;

-- Takes a contestant out of a category. It leaves the category's stored rankings right away
-- (the rest move up); its matches stay and still count toward overall, and the next refresh
-- leaves them out of the category's rankings.
create function public.remove_from_category(p_category_id uuid, p_contestant_id uuid) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  delete from public.category_memberships where category_id = p_category_id and contestant_id = p_contestant_id;
  if not found then
    return false;
  end if;

  update public.categories set cover_contestant_id = null
  where id = p_category_id and cover_contestant_id = p_contestant_id;
  delete from public.ranking_entries e using public.ranking_lists l
  where l.id = e.list_id and l.category_id = p_category_id and e.contestant_id = p_contestant_id;
  update public.ranking_entries e set position = r.position
  from (
    select list_id, contestant_id, row_number() over (partition by list_id order by position)::integer as position
    from public.ranking_entries
    where list_id in (select id from public.ranking_lists where category_id = p_category_id)
  ) r
  where e.list_id = r.list_id and e.contestant_id = r.contestant_id and e.position <> r.position;
  return true;
end;
$$;

revoke execute on function public.delete_category(uuid) from public, anon, authenticated;
revoke execute on function public.remove_from_category(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_category(uuid) to service_role;
grant execute on function public.remove_from_category(uuid, uuid) to service_role;
