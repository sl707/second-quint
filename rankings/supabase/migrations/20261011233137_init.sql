create table public.app_info (
  key text primary key,
  value text not null
);

alter table public.app_info enable row level security;

create policy "app_info is public" on public.app_info
  for select using (true);

insert into public.app_info (key, value) values ('name', 'Second Quint Rankings');
