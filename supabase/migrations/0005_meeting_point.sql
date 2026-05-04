-- Phase 7: meeting point + arrival tracking.
-- Run via Supabase Dashboard → SQL Editor → New Query.

-- Meeting-point columns on hike_rooms (one pin per crew, host-managed).
alter table public.hike_rooms
  add column meeting_point_lat double precision,
  add column meeting_point_lng double precision,
  add column meeting_point_label text default 'Meeting Point',
  add column meeting_point_set_at timestamp with time zone;

-- Track who has arrived at the meeting point.
-- Composite PK prevents duplicate rows if the geofence task fires twice.
create table public.meeting_point_arrivals (
  room_id uuid references public.hike_rooms on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  arrived_at timestamp with time zone default now() not null,
  primary key (room_id, user_id)
);

create index meeting_point_arrivals_room_idx
  on public.meeting_point_arrivals (room_id);

alter table public.meeting_point_arrivals enable row level security;

create policy "Crew members can read arrivals"
  on public.meeting_point_arrivals for select
  using (public.is_room_member(room_id, auth.uid()));

create policy "Users can record their own arrival"
  on public.meeting_point_arrivals for insert
  with check (
    auth.uid() = user_id and public.is_room_member(room_id, auth.uid())
  );

-- No update or delete policies — arrivals are immutable.
-- Re-dropping the meeting point doesn't reset prior arrivals (deliberate).

-- Realtime: crew members receive INSERTs as they happen.
alter publication supabase_realtime add table public.meeting_point_arrivals;
