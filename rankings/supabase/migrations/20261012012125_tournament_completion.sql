-- Tournament completion view for the admin: tournaments started in a New York date range, counted
-- by rated, status, size, and matches played. The server works out each count's stopping stage.
create function public.tournament_completion(p_from date, p_to date)
returns table (rated boolean, status text, size integer, matches_played integer, tournaments integer)
language sql
stable
set search_path = ''
as $$
  select t.rated, t.status, t.size, coalesce(m.played, 0)::integer, count(*)::integer
  from public.tournaments t
  left join lateral (
    select count(*) as played from public.matches where matches.tournament_id = t.id
  ) m on true
  where (p_from is null or (t.created_at at time zone 'America/New_York')::date >= p_from)
    and (p_to is null or (t.created_at at time zone 'America/New_York')::date <= p_to)
  group by 1, 2, 3, 4;
$$;

revoke execute on function public.tournament_completion(date, date) from public, anon, authenticated;
grant execute on function public.tournament_completion(date, date) to service_role;
