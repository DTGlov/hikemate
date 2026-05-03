-- Phase 6 follow-up: collect a real display_name at signup.
-- Run via Supabase Dashboard → SQL Editor → New Query.

-- Update the new-user trigger to read display_name from auth metadata.
-- Falls back to the email local-part so older signup paths keep working.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

-- Backfill existing profiles missing a display_name (or set to empty).
update public.profiles
set display_name = split_part(
  (select email from auth.users where id = profiles.id),
  '@',
  1
)
where display_name is null or display_name = '';

-- Make display_name required going forward + enforce length 2..30.
alter table public.profiles
  alter column display_name set not null,
  add constraint profiles_display_name_length
    check (length(display_name) between 2 and 30);
