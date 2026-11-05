-- Scanner heartbeat: which phones exist, when they last synced, how many rows they still hold.
-- down: drop table devices;

create table if not exists public.devices (
  device_id text primary key,
  label text,
  platform text,
  app_version text,
  event_id uuid references public.events(id),
  selected_workshop_id uuid references public.workshops(id) on delete set null,
  last_seen_at timestamptz not null default now(),
  last_sync_at timestamptz,
  unsynced_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_devices_last_seen_at on public.devices (last_seen_at);
create index if not exists idx_devices_selected_workshop_id on public.devices (selected_workshop_id);

alter table public.devices enable row level security;
create policy "Devices are viewable by anyone"   on public.devices for select using (true);
create policy "Devices are insertable by anyone" on public.devices for insert with check (true);
create policy "Devices are updatable by anyone"  on public.devices for update using (true);
