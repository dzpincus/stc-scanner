-- Phones subscribe to attendance changes for the active event as a nudge to pull.
-- RLS still applies to realtime payloads, so anon only receives active-event rows.
alter publication supabase_realtime add table public.attendance;
