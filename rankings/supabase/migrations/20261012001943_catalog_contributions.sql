-- Players grow the catalog: contestants with uploaded pictures, categories, and memberships. Writes
-- go through the server-side catalog service using the admin client, so there are no write policies.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Where a bulk-imported contestant came from (for example `mal:12345`), so re-imports find it again.
-- Internal only: never shown.
alter table public.contestants add column source_id text unique;
revoke select on public.contestants from anon, authenticated;
grant select (id, name, picture_512_url, picture_128_url, created_by, created_at, merged_into)
  on public.contestants to anon, authenticated;

-- Lowercased, accent-free name, for the similar-name warning ("Jalapeño" ~ "jalapeno").
create function private.name_key(name text) returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, name)) $$;

alter table public.contestants add column name_key text generated always as (private.name_key(name)) stored;
create index contestants_name_key_trgm_idx on public.contestants using gin (name_key extensions.gin_trgm_ops);

-- Existing contestants whose names look like `p_name`, ignoring case and accents, best first.
create function public.similar_contestants(p_name text, p_limit integer default 5)
returns table (id uuid, name text, picture_128_url text)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select private.name_key(btrim(p_name)) as key)
  select c.id, c.name, c.picture_128_url
  from public.contestants c, q
  where c.merged_into is null
    and length(q.key) > 0
    and (c.name_key operator(extensions.%) q.key
      or extensions.word_similarity(q.key, c.name_key) >= 0.6
      or c.name_key = q.key)
  order by greatest(extensions.similarity(c.name_key, q.key), extensions.word_similarity(q.key, c.name_key)) desc, c.name
  limit p_limit
$$;

grant execute on function public.similar_contestants(text, integer) to anon, authenticated, service_role;

-- Whether a contestant has had its first rated match decides who may edit or delete it.
create index matches_rated_winner_idx on public.matches (winner_id) where rated;
create index matches_rated_loser_idx on public.matches (loser_id) where rated;

-- Deletes a contestant with everything that can't stand without it: its matches, and every
-- tournament whose bracket drew it (their brackets can't be replayed without it).
-- Returns the picture URLs no remaining contestant uses, so the caller can remove the files.
create function public.delete_contestant(p_contestant_id uuid) returns text[]
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

  delete from public.tournaments where bracket -> 'slots' ? p_contestant_id::text;
  delete from public.matches where winner_id = p_contestant_id or loser_id = p_contestant_id;
  update public.contestants set merged_into = null where merged_into = p_contestant_id;
  delete from public.contestants where id = p_contestant_id;

  return array(
    select distinct url from unnest(pictures) as url
    where not exists (
      select 1 from public.contestants c where c.picture_512_url = url or c.picture_128_url = url
    )
  );
end;
$$;

revoke execute on function public.delete_contestant(uuid) from public, anon, authenticated;
grant execute on function public.delete_contestant(uuid) to service_role;

-- Contestant pictures: public to read, written only by the server. Object names are the SHA-256 of
-- their bytes, so a stored picture never changes and can be cached forever.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pictures', 'pictures', true, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;
