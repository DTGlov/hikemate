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

-- Helper function: checks room membership without triggering RLS recursion.
-- security definer bypasses RLS on the inner query, preventing infinite recursion
-- when the room_members SELECT policy needs to check membership of the same table.
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

grant execute on function public.is_room_member(uuid, uuid) to authenticated;

-- RLS
alter table public.hike_rooms enable row level security;
alter table public.room_members enable row level security;

-- Hike rooms policies
create policy "Anyone authenticated can find rooms by code"
  on public.hike_rooms for select
  using (auth.uid() is not null);

create policy "Authenticated users can create rooms"
  on public.hike_rooms for insert
  with check (auth.uid() = host_id);

create policy "Hosts can update their rooms"
  on public.hike_rooms for update
  using (auth.uid() = host_id);

-- Room members policies
-- SELECT: allow users to read their own membership row directly (handles
-- post-insert .select() and avoids 'stable' caching gotcha with is_room_member),
-- OR read other members in rooms they belong to.
create policy "Members can read fellow members"
  on public.room_members for select
  using (
    user_id = auth.uid()
    or public.is_room_member(room_id, auth.uid())
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

-- Function: end a room (sets ended_at, only callable by the host)
create or replace function public.end_hike_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
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

-- Realtime: enable for both tables
alter publication supabase_realtime add table public.hike_rooms;
alter publication supabase_realtime add table public.room_members;