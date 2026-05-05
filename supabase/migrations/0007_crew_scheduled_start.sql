-- Phase 8 — Local Notifications
--
-- Adds an optional crew start time. When set by the host, every member's
-- phone schedules a local "starts in 30 minutes" reminder via
-- expo-notifications. The reminder is purely client-side (no remote push)
-- and the column is the only durable state needed for it.
alter table public.hike_rooms
  add column scheduled_start_at timestamp with time zone;
