-- Catalog, tournaments, and matches. Everything here is public to read; writes go through the
-- server-side game and catalog services using the admin client, so there are no write policies.
-- player_id and created_by columns get their foreign keys to players when sign-in arrives.

create table public.contestants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  picture_512_url text not null,
  picture_128_url text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  merged_into uuid references public.contestants (id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 280),
  cover_contestant_id uuid references public.contestants (id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.category_memberships (
  category_id uuid not null references public.categories (id) on delete cascade,
  contestant_id uuid not null references public.contestants (id) on delete cascade,
  added_by uuid,
  created_at timestamptz not null default now(),
  primary key (category_id, contestant_id)
);

create index category_memberships_contestant_idx on public.category_memberships (contestant_id);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid,
  visitor_id uuid,
  -- null scope = all contestants
  category_id uuid references public.categories (id) on delete set null,
  size integer not null check (size >= 4),
  rated boolean not null default false,
  hand_picked boolean not null default false,
  reserved_allowance integer not null default 0,
  -- {"slots": [contestant id or null for a bye, …]} in first-round bracket order
  bracket jsonb not null,
  -- whether the most recent pick can still be undone (one undo per pick)
  can_undo boolean not null default false,
  status text not null default 'in_progress' check (status in ('in_progress', 'finished', 'given_up')),
  allowance_day date,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check (num_nonnulls(player_id, visitor_id) = 1)
);

create index tournaments_visitor_idx on public.tournaments (visitor_id, status) where visitor_id is not null;
create index tournaments_player_idx on public.tournaments (player_id, status) where player_id is not null;

create table public.matches (
  id bigint generated always as identity primary key,
  winner_id uuid not null references public.contestants (id),
  loser_id uuid not null references public.contestants (id),
  -- null scope = all contestants
  category_id uuid references public.categories (id) on delete set null,
  player_id uuid,
  visitor_id uuid,
  rated boolean not null default false,
  tournament_id uuid references public.tournaments (id) on delete cascade,
  round smallint,
  -- position in the tournament's play order, from 0
  bracket_match smallint,
  played_at timestamptz not null default now(),
  excluded boolean not null default false,
  check (winner_id <> loser_id),
  check (num_nonnulls(player_id, visitor_id) = 1),
  check ((tournament_id is null) = (round is null) and (tournament_id is null) = (bracket_match is null)),
  unique (tournament_id, bracket_match)
);

create index matches_category_idx on public.matches (category_id, played_at);
create index matches_played_at_idx on public.matches (played_at);

alter table public.contestants enable row level security;
alter table public.categories enable row level security;
alter table public.category_memberships enable row level security;
alter table public.tournaments enable row level security;
alter table public.matches enable row level security;

create policy "contestants are public" on public.contestants for select using (true);
create policy "categories are public" on public.categories for select using (true);
create policy "category memberships are public" on public.category_memberships for select using (true);
create policy "tournaments are public" on public.tournaments for select using (true);
create policy "matches are public" on public.matches for select using (true);

-- An anonymous visitor ID works like a password for that visitor's tournaments, so it is never readable.
revoke select on public.tournaments, public.matches from anon, authenticated;
grant select (id, player_id, category_id, size, rated, hand_picked, reserved_allowance, bracket, can_undo, status,
  allowance_day, created_at, finished_at) on public.tournaments to anon, authenticated;
grant select (id, winner_id, loser_id, category_id, player_id, rated, tournament_id, round, bracket_match, played_at,
  excluded) on public.matches to anon, authenticated;
