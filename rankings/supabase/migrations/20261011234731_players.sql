-- Players: a signed-in account with a chosen display name. The row is created when the display name
-- is chosen at first sign-in, so every player has one. Writes go through the server-side profiles
-- service using the admin client, so there are no write policies.

create table public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id),
  display_name text not null
    check (char_length(display_name) between 3 and 24 and display_name ~ '^[A-Za-z0-9_-]+$'),
  -- display names are unique ignoring case; profiles are looked up by this key
  display_name_key text generated always as (lower(display_name)) stored unique,
  is_admin boolean not null default false,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.players enable row level security;

create policy "players are public" on public.players for select using (true);

-- Which auth user (and so which Google account) a player is stays private.
revoke select on public.players from anon, authenticated;
grant select (id, display_name, is_admin, banned, created_at) on public.players to anon, authenticated;

alter table public.tournaments add foreign key (player_id) references public.players (id);
alter table public.matches add foreign key (player_id) references public.players (id);
alter table public.contestants add foreign key (created_by) references public.players (id);
alter table public.categories add foreign key (created_by) references public.players (id);
alter table public.category_memberships add foreign key (added_by) references public.players (id);

create index matches_player_idx on public.matches (player_id, played_at) where player_id is not null;
