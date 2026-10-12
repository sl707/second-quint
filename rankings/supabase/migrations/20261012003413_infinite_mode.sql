-- Infinite Mode: the pair currently offered to each player or visitor in each scope. Reloading shows
-- the same pair; the only ways to a new one are picking a winner or skipping, which delete the row,
-- so a pair can be picked once and skips can be counted.

create table public.infinite_pairs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players (id) on delete cascade,
  visitor_id uuid,
  -- null scope = all contestants
  category_id uuid references public.categories (id) on delete cascade,
  first_contestant_id uuid not null references public.contestants (id) on delete cascade,
  second_contestant_id uuid not null references public.contestants (id) on delete cascade,
  offered_at timestamptz not null default now(),
  check (first_contestant_id <> second_contestant_id),
  check (num_nonnulls(player_id, visitor_id) = 1),
  constraint infinite_pairs_owner_scope_key unique nulls not distinct (player_id, visitor_id, category_id)
);

-- Private to the server-side game service, which uses the admin client.
alter table public.infinite_pairs enable row level security;
