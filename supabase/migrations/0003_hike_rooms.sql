-- Phase 6: hike rooms (live group hike sharing)
-- Run via Supabase Dashboard → SQL Editor → New Query.
-- Safe to re-run? No — table creation will fail on the second run.

-- Hike rooms table
create table public.hike_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) = 6),
  name text,
  host_id uuid references auth.users on delete cascade not null,
  started_at timestamp with time zone default now() not null,
  ended_at timestamp with time zone,
  expires_at timestamp with time zone not null default (now() + interval '24 hours'),
  created_at timestamp with time zone default now() not null
);

create index hike_rooms_code_idx on public.hike_rooms (code) where ended_at is null;
create index hike_rooms_host_idx on public.hike_rooms (host_id);

-- Room members table
create table public.room_members (
  room_id uuid references public.hike_rooms on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  display_name text not null,
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  joined_at timestamp with time zone default now() not null,
  last_known_lat double precision,
  last_known_lng double precision,
  last_known_altitude double precision,
  last_seen_at timestamp with time zone default now() not null,
  primary key (room_id, user_id)
);

create index room_members_user_idx on public.room_members (user_id);

-- RLS
alter table public.hike_rooms enable row level security;
alter table public.room_members enable row level security;

-- Hike rooms: any authenticated user can read by code (for join), host can update/end
create policy "Anyone authenticated can find rooms by code"
  on public.hike_rooms for select
  using (auth.uid() is not null);

create policy "Authenticated users can create rooms"
  on public.hike_rooms for insert
  with check (auth.uid() = host_id);

create policy "Hosts can update their rooms"
  on public.hike_rooms for update
  using (auth.uid() = host_id);

-- Room members: members of a room can see other members of THE SAME room
create policy "Members can read fellow members"
  on public.room_members for select
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = room_members.room_id and rm.user_id = auth.uid()
    )
  );

create policy "Users can join rooms (insert themselves)"
  on public.room_members for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own member row"
  on public.room_members for update
  using (auth.uid() = user_id);

create policy "Users can leave rooms (delete themselves)"
  on public.room_members for delete
  using (auth.uid() = user_id);

-- RPC: end a room (sets ended_at). Only the host may invoke this.
create or replace function public.end_hike_room(p_room_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from public.hike_rooms
    where id = p_room_id and host_id = auth.uid() and ended_at is null
  ) then
    raise exception 'Not authorized to end this room';
  end if;

  update public.hike_rooms
  set ended_at = now()
  where id = p_room_id;
end;
$$;

grant execute on function public.end_hike_room(uuid) to authenticated;

-- Trigger: auto-end a room when its last member leaves. Server-side because
-- we cannot trust the last-leaver client to call end_hike_room (they may
-- have crashed).
create or replace function public.auto_end_empty_room()
returns trigger
language plpgsql
security definer
as $$
declare
  remaining int;
begin
  select count(*) into remaining
  from public.room_members
  where room_id = old.room_id;

  if remaining = 0 then
    update public.hike_rooms
    set ended_at = now()
    where id = old.room_id and ended_at is null;
  end if;

  return old;
end;
$$;

create trigger room_members_auto_end_empty
  after delete on public.room_members
  for each row execute procedure public.auto_end_empty_room();

-- Realtime: enable for both tables so clients can subscribe to changes.
alter publication supabase_realtime add table public.hike_rooms;
alter publication supabase_realtime add table public.room_members;
