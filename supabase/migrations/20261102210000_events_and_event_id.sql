-- Events: one row per conference. Existing 2025 data is archived under slug '2025';
-- new rows default to the active event via current_event_id().
-- down: drop trigger set_attendance_event_id on attendance; drop function set_attendance_event_id, current_event_id;
--       drop column event_id from workshops, students, attendance, email_log; drop table events.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  event_date date,
  is_active boolean not null default false,
  locked boolean not null default false,  -- true = doors open: admin refuses deletes/imports
  created_at timestamptz not null default now()
);
comment on column public.events.locked is 'Event mode. When true the admin blocks destructive actions (deletes, non-dry-run imports).';

create unique index if not exists events_one_active_idx on public.events (is_active) where is_active;

alter table public.events enable row level security;
create policy "Events are viewable by anyone" on public.events for select using (true);

create or replace function public.current_event_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.events where is_active limit 1;
$$;

insert into public.events (slug, name, event_date, is_active)
values ('2025', 'Stage the Change 2025', '2025-11-14', false),
       ('2026', 'Stage the Change 2026', null, true)
on conflict (slug) do nothing;

-- event_id columns: add, backfill to 2025, then enforce not null + default.
alter table public.workshops  add column if not exists event_id uuid references public.events(id);
alter table public.students   add column if not exists event_id uuid references public.events(id);
alter table public.attendance add column if not exists event_id uuid references public.events(id);
alter table public.email_log  add column if not exists event_id uuid references public.events(id);

update public.workshops  set event_id = (select id from public.events where slug = '2025') where event_id is null;
update public.students   set event_id = (select id from public.events where slug = '2025') where event_id is null;
update public.email_log  set event_id = (select id from public.events where slug = '2025') where event_id is null;
update public.attendance a set event_id = s.event_id from public.students s where a.student_id = s.id and a.event_id is null;

alter table public.workshops  alter column event_id set not null, alter column event_id set default public.current_event_id();
alter table public.students   alter column event_id set not null, alter column event_id set default public.current_event_id();
alter table public.email_log  alter column event_id set not null, alter column event_id set default public.current_event_id();
alter table public.attendance alter column event_id set not null;

create index if not exists idx_workshops_event_id  on public.workshops (event_id);
create index if not exists idx_students_event_id   on public.students (event_id);
create index if not exists idx_attendance_event_id on public.attendance (event_id);
create index if not exists idx_email_log_event_id  on public.email_log (event_id);

-- attendance.event_id always follows the student (never trust the client for it).
create or replace function public.set_attendance_event_id()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select event_id into new.event_id from public.students where id = new.student_id;
  if new.event_id is null then
    raise exception 'attendance.student_id % does not exist', new.student_id;
  end if;
  return new;
end;
$$;
create trigger set_attendance_event_id
  before insert or update of student_id on public.attendance
  for each row execute function public.set_attendance_event_id();

-- Advisor fixes: pin search_path on existing functions.
alter function public.update_updated_at_column() set search_path = '';
create or replace function public.get_workshop_attendance_summary(workshop_uuid uuid)
returns table (total_registered integer, total_attended integer, total_absent integer, total_wrong_workshop integer)
language plpgsql stable set search_path = ''
as $$
begin
  return query
  select
    count(distinct s.id)::integer,
    count(distinct a.id)::integer,
    (count(distinct s.id) - count(distinct a.id))::integer,
    (count(distinct a.id) filter (where a.is_correct_workshop = false))::integer
  from public.students s
  left join public.attendance a on s.id = a.student_id and a.workshop_id = workshop_uuid
  where s.workshop_slot1_id = workshop_uuid or s.workshop_slot2_id = workshop_uuid;
end;
$$;
