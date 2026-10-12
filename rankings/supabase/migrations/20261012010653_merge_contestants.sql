-- Merging duplicate contestants: the admin folds a duplicate into a survivor in one transaction.
-- The duplicate's row stays, pointing at the survivor through merged_into, so its page redirects
-- and old links keep working; it leaves every list and category.

-- Returns 'merged', or why nothing happened: 'same' (one contestant twice), 'missing' (either one
-- doesn't exist), or 'already_merged' (either one was already merged away).
create function public.merge_contestants(p_duplicate_id uuid, p_survivor_id uuid) returns text
language plpgsql
set search_path = ''
as $$
declare
  duplicate public.contestants;
  survivor public.contestants;
  touched_lists bigint[];
begin
  if p_duplicate_id = p_survivor_id then
    return 'same';
  end if;
  -- Lock both in a fixed order, so two merges of the same pair can't deadlock.
  perform 1 from public.contestants where id in (p_duplicate_id, p_survivor_id) order by id for update;
  select * into duplicate from public.contestants where id = p_duplicate_id;
  select * into survivor from public.contestants where id = p_survivor_id;
  if duplicate.id is null or survivor.id is null then
    return 'missing';
  end if;
  if duplicate.merged_into is not null or survivor.merged_into is not null then
    return 'already_merged';
  end if;

  -- A tournament that drew both would hold the survivor twice and lose the matches between them,
  -- so it ends as removed (its other matches still count). In every bracket the survivor takes the
  -- duplicate's slot, so the moved matches still replay.
  update public.tournaments
  set status = 'removed', can_undo = false, finished_at = coalesce(finished_at, now())
  where bracket -> 'slots' ? p_duplicate_id::text and bracket -> 'slots' ? p_survivor_id::text and status <> 'removed';
  update public.tournaments t
  set bracket = jsonb_set(t.bracket, '{slots}', (
    select jsonb_agg(case when s = to_jsonb(p_duplicate_id::text) then to_jsonb(p_survivor_id::text) else s end order by i)
    from jsonb_array_elements(t.bracket -> 'slots') with ordinality as e (s, i)
  ))
  where t.bracket -> 'slots' ? p_duplicate_id::text;

  delete from public.matches
  where (winner_id = p_duplicate_id and loser_id = p_survivor_id) or (winner_id = p_survivor_id and loser_id = p_duplicate_id);
  update public.matches set winner_id = p_survivor_id where winner_id = p_duplicate_id;
  update public.matches set loser_id = p_survivor_id where loser_id = p_duplicate_id;

  -- An offered Infinite Mode pair of the two is withdrawn; any other offered pair keeps going.
  delete from public.infinite_pairs
  where (first_contestant_id = p_duplicate_id and second_contestant_id = p_survivor_id)
     or (first_contestant_id = p_survivor_id and second_contestant_id = p_duplicate_id);
  update public.infinite_pairs set first_contestant_id = p_survivor_id where first_contestant_id = p_duplicate_id;
  update public.infinite_pairs set second_contestant_id = p_survivor_id where second_contestant_id = p_duplicate_id;

  insert into public.category_memberships (category_id, contestant_id, added_by, created_at)
  select category_id, p_survivor_id, added_by, created_at from public.category_memberships where contestant_id = p_duplicate_id
  on conflict do nothing;
  delete from public.category_memberships where contestant_id = p_duplicate_id;
  update public.categories set cover_contestant_id = p_survivor_id where cover_contestant_id = p_duplicate_id;

  -- The duplicate leaves the stored rankings at once (the rest move up); the survivor's entries
  -- take in its matches at the next refresh. Its weekly rating snapshots stay with its own row.
  select array_agg(list_id) into touched_lists from public.ranking_entries where contestant_id = p_duplicate_id;
  delete from public.ranking_entries where contestant_id = p_duplicate_id;
  update public.ranking_entries e set position = r.position
  from (
    select list_id, contestant_id, row_number() over (partition by list_id order by position)::integer as position
    from public.ranking_entries
    where list_id = any (touched_lists)
  ) r
  where e.list_id = r.list_id and e.contestant_id = r.contestant_id and e.position <> r.position;

  -- A bulk import's ID moves to the survivor unless it has its own; an importer that finds the
  -- duplicate's ID follows merged_into.
  if survivor.source_id is null and duplicate.source_id is not null then
    update public.contestants set source_id = null where id = p_duplicate_id;
    update public.contestants set source_id = duplicate.source_id where id = p_survivor_id;
  end if;
  update public.contestants set merged_into = p_survivor_id where merged_into = p_duplicate_id or id = p_duplicate_id;
  update public.reports set status = 'resolved', closed_at = now()
  where target_type = 'contestant' and target_id = p_duplicate_id and status = 'open';
  return 'merged';
end;
$$;

revoke execute on function public.merge_contestants(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_contestants(uuid, uuid) to service_role;
