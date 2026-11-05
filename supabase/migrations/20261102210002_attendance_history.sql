-- Audit trail for every attendance mutation. Deletes left no trace in 2025; this makes any
-- wipe or overwrite reconstructable.
-- down: drop trigger attendance_audit on attendance; drop function log_attendance_change; drop table attendance_history;

create table if not exists public.attendance_history (
  id bigint generated always as identity primary key,
  attendance_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  row_data jsonb not null,          -- NEW row (INSERT/UPDATE) or OLD row (DELETE)
  old_data jsonb,                   -- OLD row for UPDATE
  changed_at timestamptz not null default now(),
  changed_by_role text,
  changed_by_uid uuid,
  device_id text
);
create index if not exists idx_attendance_history_attendance_id on public.attendance_history (attendance_id);
create index if not exists idx_attendance_history_changed_at on public.attendance_history (changed_at);

alter table public.attendance_history enable row level security;
create policy "Attendance history is viewable by anyone" on public.attendance_history for select using (true);
-- no insert/update/delete policies: only the security-definer trigger writes here.

create or replace function public.log_attendance_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  v_uid uuid := auth.uid();
begin
  if tg_op = 'DELETE' then
    insert into public.attendance_history (attendance_id, operation, row_data, changed_by_role, changed_by_uid, device_id)
    values (old.id, tg_op, to_jsonb(old), v_role, v_uid, old.scanner_device_id);
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.attendance_history (attendance_id, operation, row_data, old_data, changed_by_role, changed_by_uid, device_id)
    values (new.id, tg_op, to_jsonb(new), to_jsonb(old), v_role, v_uid, new.scanner_device_id);
    return new;
  else
    insert into public.attendance_history (attendance_id, operation, row_data, changed_by_role, changed_by_uid, device_id)
    values (new.id, tg_op, to_jsonb(new), v_role, v_uid, new.scanner_device_id);
    return new;
  end if;
end;
$$;

create trigger attendance_audit
  after insert or update or delete on public.attendance
  for each row execute function public.log_attendance_change();
