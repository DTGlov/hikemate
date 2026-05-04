-- Phase 6.8: avatar_seed on profiles + room_members.
-- Run via Supabase Dashboard → SQL Editor → New Query.

-- 1. profiles.avatar_seed: stable per-user identity for DiceBear URLs.
alter table public.profiles
  add column avatar_seed text;

-- Backfill existing users with their user_id, which is stable + unique.
update public.profiles
set avatar_seed = id::text
where avatar_seed is null;

alter table public.profiles
  alter column avatar_seed set not null;

-- 2. room_members.avatar_seed: snapshot at join time (same pattern as
--    display_name + color). Left nullable so older clients that don't
--    yet write the column can still upsert; the JS Avatar component
--    falls back to a colored initials circle when null.
alter table public.room_members
  add column avatar_seed text;

update public.room_members rm
set avatar_seed = p.avatar_seed
from public.profiles p
where rm.user_id = p.id and rm.avatar_seed is null;

-- 3. Update the new-user trigger so signup populates avatar_seed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_seed)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    new.id::text
  );
  return new;
end;
$$;
