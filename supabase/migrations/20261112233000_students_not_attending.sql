-- Soft "not attending" flag for students a school reported absent on event day.
-- Set by the admin import ("mark students missing from this file as not attending") or the
-- student edit form. Flagged students with no scans are left out of expected counts and
-- supervisor emails; they are never deleted, so a badge scan still works if they turn up.
-- Phones ignore the column (explicit column list on local insert).

alter table public.students
  add column if not exists not_attending boolean not null default false;

comment on column public.students.not_attending is
  'Reported absent for the event. Excluded from expected counts and emails unless scanned. Reversible.';
