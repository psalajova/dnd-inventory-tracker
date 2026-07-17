-- Run this in Supabase: SQL Editor → New query → paste → Run

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity integer not null default 1 check (quantity >= 0),
  weight numeric(10, 2),
  category text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index characters_user_id_idx on public.characters (user_id);
create index inventory_items_character_id_idx on public.inventory_items (character_id);
create index inventory_items_user_id_idx on public.inventory_items (user_id);

alter table public.characters enable row level security;
alter table public.inventory_items enable row level security;

create policy "Users manage own characters"
  on public.characters
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own inventory"
  on public.inventory_items
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger characters_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();
