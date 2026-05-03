-- Phase 4: profiles + hikes
-- Run via Supabase Dashboard → SQL Editor → New Query.
-- Safe to re-run? No — table creation will fail on the second run.
-- If you need to redo, drop the tables (which cascades from auth.users) first.

-- Profiles table: extends auth.users with app-specific user data
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro')),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Hikes table: each row is one completed hike
create table public.hikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text,
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  distance_meters double precision not null check (distance_meters >= 0),
  elevation_gain_meters double precision not null default 0 check (elevation_gain_meters >= 0),
  elevation_loss_meters double precision not null default 0 check (elevation_loss_meters >= 0),
  -- GPS path stored as JSONB array of [longitude, latitude, altitude, timestamp_ms]
  path jsonb not null,
  -- Bounding box for fast region queries: [minLng, minLat, maxLng, maxLat]
  bounding_box jsonb not null,
  created_at timestamp with time zone default now() not null
);

create index hikes_user_id_started_at_idx on public.hikes (user_id, started_at desc);

-- Row level security
alter table public.profiles enable row level security;
alter table public.hikes enable row level security;

-- Profiles policies
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Hikes policies
create policy "Users can read their own hikes"
  on public.hikes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own hikes"
  on public.hikes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own hikes"
  on public.hikes for update
  using (auth.uid() = user_id);

create policy "Users can delete their own hikes"
  on public.hikes for delete
  using (auth.uid() = user_id);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- One-time backfill for any existing auth.users (e.g. accounts created
-- during Phase 2 testing) that don't yet have a profiles row.
insert into public.profiles (id, display_name)
select id, email from auth.users
where id not in (select id from public.profiles);
