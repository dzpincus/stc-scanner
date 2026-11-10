-- Test dataset for the admin dashboard, scanner and supervisor emails.
--
-- Lives in its own event (slug 'test', events.is_test = true). Safe to re-run: it wipes and
-- rebuilds ONLY the test event's rows (including its email history, so sends start fresh).
-- It never touches another event and never changes which event is active.
--
-- Switch datasets from the event menu in the admin header, or in SQL:
--   select slug, is_active from public.set_active_event('test');   -- test data live
--   select slug, is_active from public.set_active_event('2026');   -- back to the real event
--
-- Every supervisor address is dpincus95[+tag]@stagethechange.org, so one inbox receives
-- everything. The +tag makes each supervisor a separate recipient (the app groups by email
-- address). Two supervisors deliberately share the bare address to show that merge.
-- Each student's `notes` says what the emails should show for them.

begin;

insert into public.events (slug, name, is_test)
values ('test', 'TEST DATA (not a real event)', true)
on conflict (slug) do update set is_test = true;

-- Reset, scoped to the test event only.
delete from public.attendance where event_id = (select id from public.events where slug = 'test' and is_test);
delete from public.email_log  where event_id = (select id from public.events where slug = 'test' and is_test);
delete from public.students   where event_id = (select id from public.events where slug = 'test' and is_test);
delete from public.workshops  where event_id = (select id from public.events where slug = 'test' and is_test);

-- Workshops. Some rooms are blank on purpose (rooms are optional).
insert into public.workshops (event_id, workshop_name, time_slot, room_location)
select e.id, w.name, w.slot, w.room
from public.events e,
  (values
    ('T 1: Improv Basics',     1, 'Room 101'),
    ('T 2: Stage Combat',      1, 'Auditorium'),
    ('T 3: Playwriting Lab',   1, null),
    ('T 4: Dance Your Voice',  1, 'Room 204'),
    ('Stage Crew',             1, null),
    ('T 1: Improv Basics',     2, 'Room 101'),
    ('T 2: Stage Combat',      2, 'Auditorium'),
    ('T 3: Playwriting Lab',   2, null),
    ('T 5: Film & Story',      2, 'Room 110'),
    ('Stage Crew',             2, null)
  ) as w(name, slot, room)
where e.slug = 'test';

-- s1/s2 = what happened in that slot:
--   present  scanned at the registered workshop        absent  no scan
--   manual   checked in from the dashboard             wrong   scanned only at workshop o1/o2
--   both     registered scan plus a scan at o1/o2      walkin  no registration, scanned at o1/o2
--   none     not registered, not scanned
create temp table seed_students (
  n int, student_name text, supervisor_name text, tag text,
  w1 text, w2 text, s1 text, o1 text, s2 text, o2 text, notes text
) on commit drop;

insert into seed_students values
-- Avery Stone: large mixed group. Slot 1 = 9 of 12 present, slot 2 = 9 of 12 present.
( 1, 'Amara Bell',      'Avery Stone', 'stone', 'T 1: Improv Basics',    'T 2: Stage Combat',    'present', null, 'present', null, 'Present both slots'),
( 2, 'Ben Castillo',    'Avery Stone', 'stone', 'T 1: Improv Basics',    'T 1: Improv Basics',   'present', null, 'absent',  null, 'Slot 1 present, slot 2 absent'),
( 3, 'Chloe Dimitrov',  'Avery Stone', 'stone', 'T 2: Stage Combat',     'T 3: Playwriting Lab', 'absent',  null, 'present', null, 'Slot 1 absent, slot 2 present'),
( 4, 'Dev Easton',      'Avery Stone', 'stone', 'T 2: Stage Combat',     'T 5: Film & Story',    'absent',  null, 'absent',  null, 'Absent both slots'),
( 5, 'Elena Fischer',   'Avery Stone', 'stone', 'T 3: Playwriting Lab',  'T 2: Stage Combat',    'wrong',   'T 1: Improv Basics', 'present', null, 'Slot 1: Present + Wrong: T 1. Slot 2 present'),
( 6, 'Farid Gomez',     'Avery Stone', 'stone', 'T 3: Playwriting Lab',  'T 3: Playwriting Lab', 'wrong',   'T 4: Dance Your Voice', 'wrong', 'T 5: Film & Story', 'Wrong workshop in BOTH slots: Present + Wrong in each email'),
( 7, 'Greta Holm',      'Avery Stone', 'stone', 'T 4: Dance Your Voice', 'T 5: Film & Story',    'both',    'T 2: Stage Combat', 'present', null, 'Slot 1: registered scan plus extra wrong scan (Present + Wrong: T 2)'),
( 8, 'Hugo Ito',        'Avery Stone', 'stone', 'T 4: Dance Your Voice', 'T 1: Improv Basics',   'manual',  null, 'manual',  null, 'Manual dashboard check-in both slots: Present'),
( 9, 'Imani Jones',     'Avery Stone', 'stone', 'T 1: Improv Basics',    'T 2: Stage Combat',    'present', null, 'wrong',   'T 3: Playwriting Lab', 'Slot 1 present. Slot 2: Present + Wrong: T 3'),
(10, 'Jonas Keller',    'Avery Stone', 'stone', 'T 2: Stage Combat',     'T 1: Improv Basics',   'manual',  null, 'absent',  null, 'Slot 1 manual check-in, slot 2 absent'),
(11, 'Kira Lopez',      'Avery Stone', 'stone', 'T 1: Improv Basics',    'T 5: Film & Story',    'present', null, 'present', null, 'Present both slots'),
(12, 'Liam Moreau',     'Avery Stone', 'stone', 'T 3: Playwriting Lab',  'T 2: Stage Combat',    'absent',  null, 'present', null, 'Slot 1 absent, slot 2 present'),
(13, 'Mina Novak',      'Avery Stone', 'stone', null,                    null,                   'none',    null, 'none',    null, 'No workshops: must NOT appear in any email'),
-- Blake Rivera: everyone present, 100% in both emails.
(14, 'Nadia Okafor',    'Blake Rivera', 'rivera', 'T 1: Improv Basics',    'T 2: Stage Combat',    'present', null, 'present', null, 'Present both slots'),
(15, 'Owen Park',       'Blake Rivera', 'rivera', 'T 2: Stage Combat',     'T 1: Improv Basics',   'present', null, 'present', null, 'Present both slots'),
(16, 'Priya Quinn',     'Blake Rivera', 'rivera', 'T 3: Playwriting Lab',  'T 5: Film & Story',    'present', null, 'present', null, 'Present both slots'),
(17, 'Rafael Santos',   'Blake Rivera', 'rivera', 'T 4: Dance Your Voice', 'T 3: Playwriting Lab', 'present', null, 'present', null, 'Present both slots'),
(18, 'Sara Thorne',     'Blake Rivera', 'rivera', 'T 1: Improv Basics',    'T 5: Film & Story',    'present', null, 'present', null, 'Present both slots'),
-- Casey Nguyen: nobody showed up, 0.0% in both emails.
(19, 'Theo Ueda',       'Casey Nguyen', 'nguyen', 'T 1: Improv Basics',    'T 2: Stage Combat',    'absent',  null, 'absent',  null, 'Absent both slots'),
(20, 'Uma Vance',       'Casey Nguyen', 'nguyen', 'T 2: Stage Combat',     'T 1: Improv Basics',   'absent',  null, 'absent',  null, 'Absent both slots'),
(21, 'Victor Wells',    'Casey Nguyen', 'nguyen', 'T 3: Playwriting Lab',  'T 5: Film & Story',    'absent',  null, 'absent',  null, 'Absent both slots'),
(22, 'Wren Xu',         'Casey Nguyen', 'nguyen', 'T 4: Dance Your Voice', 'T 3: Playwriting Lab', 'absent',  null, 'absent',  null, 'Absent both slots'),
-- No supervisor name: greeting falls back to "Hello Supervisor".
(23, 'Yara Zimmer',     null, 'noname', 'T 1: Improv Basics',    'T 2: Stage Combat',    'present', null, 'absent',  null, 'Supervisor has no name. Slot 1 present, slot 2 absent'),
(24, 'Zane Abbott',     null, 'noname', 'T 2: Stage Combat',     'T 5: Film & Story',    'absent',  null, 'present', null, 'Supervisor has no name. Slot 1 absent, slot 2 present'),
(25, 'Ada Brooks',      null, 'noname', 'T 4: Dance Your Voice', 'T 1: Improv Basics',   'present', null, 'present', null, 'Supervisor has no name. Present both slots'),
-- Awkward characters: must display literally, never as formatting or broken symbols.
(26, 'Zoë Núñez-O''Brien',        'Dana O''Neil-Smith', 'oneil', 'T 1: Improv Basics',   'T 5: Film & Story',    'present', null, 'present', null, 'Accents and apostrophe must display correctly'),
(27, 'Tom "TJ" Baker',            'Dana O''Neil-Smith', 'oneil', 'T 2: Stage Combat',    'T 5: Film & Story',    'present', null, 'absent',  null, 'Double quotes in name'),
(28, 'Ana <b>Bold</b> & Sons',    'Dana O''Neil-Smith', 'oneil', 'T 3: Playwriting Lab', 'T 5: Film & Story',    'absent',  null, 'present', null, 'HTML in name must show as plain text, not bold'),
(29, '李 Wei',                     'Dana O''Neil-Smith', 'oneil', 'T 1: Improv Basics',   'T 2: Stage Combat',    'wrong',   'T 2: Stage Combat', 'present', null, 'Non-Latin name. Slot 1: Present + Wrong: T 2'),
-- Two supervisor names on the SAME bare address: the app sends one merged email of 6 students.
(30, 'Cora Diaz',       'Emery Fox',   null, 'T 1: Improv Basics',    'T 2: Stage Combat',    'present', null, 'present', null, 'Shares an address with Finley Park''s students: one merged email'),
(31, 'Dax Ellis',       'Emery Fox',   null, 'T 2: Stage Combat',     'T 1: Improv Basics',   'absent',  null, 'present', null, 'Merged email. Slot 1 absent, slot 2 present'),
(32, 'Esme Flores',     'Emery Fox',   null, 'T 4: Dance Your Voice', 'T 3: Playwriting Lab', 'present', null, 'absent',  null, 'Merged email. Slot 1 present, slot 2 absent'),
(33, 'Finn Garcia',     'Finley Park', null, 'T 3: Playwriting Lab',  'T 5: Film & Story',    'present', null, 'present', null, 'Shares an address with Emery Fox''s students: one merged email'),
(34, 'Gia Hart',        'Finley Park', null, 'T 1: Improv Basics',    'T 1: Improv Basics',   'manual',  null, 'absent',  null, 'Merged email. Slot 1 manual check-in, slot 2 absent'),
(35, 'Hank Irving',     'Finley Park', null, 'T 2: Stage Combat',     'T 2: Stage Combat',    'absent',  null, 'absent',  null, 'Merged email. Absent both slots'),
-- Crew: same workshop in both slots, no room.
(36, 'Ivy Jensen',      'Gray Morgan', 'crew', 'Stage Crew', 'Stage Crew', 'present', null, 'present', null, 'Crew, present both slots'),
(37, 'Jude Kim',        'Gray Morgan', 'crew', 'Stage Crew', 'Stage Crew', 'present', null, 'absent',  null, 'Crew, slot 1 present, slot 2 absent'),
-- Registered for slot 2 only: this supervisor gets a slot 2 email and NO slot 1 email.
(38, 'Kai Lambert',     'Harper Lane', 'slot2only', null, 'T 5: Film & Story', 'walkin', 'T 1: Improv Basics', 'present', null, 'Slot 2 only (supervisor gets no slot 1 email). Walk-in at T 1 in slot 1');

insert into public.students
  (event_id, registration_id, student_name, supervisor_name, supervisor_email, workshop_slot1_id, workshop_slot2_id, notes)
select
  e.id,
  'TEST' || lpad(t.n::text, 15, '0'),
  t.student_name,
  t.supervisor_name,
  'dpincus95' || coalesce('+' || t.tag, '') || '@stagethechange.org',
  w1.id,
  w2.id,
  'TEST CASE: ' || t.notes
from seed_students t
join public.events e on e.slug = 'test'
left join public.workshops w1 on w1.event_id = e.id and w1.time_slot = 1 and w1.workshop_name = t.w1
left join public.workshops w2 on w2.event_id = e.id and w2.time_slot = 2 and w2.workshop_name = t.w2;

-- Attendance. event_id is filled by trigger from the student.
with slots as (
  select
    s.id as student_id, e.id as event_id, x.slot, x.status, x.other, t.n,
    case x.slot when 1 then s.workshop_slot1_id else s.workshop_slot2_id end as registered_id
  from seed_students t
  join public.events e on e.slug = 'test'
  join public.students s on s.event_id = e.id and s.registration_id = 'TEST' || lpad(t.n::text, 15, '0')
  cross join lateral (values (1, t.s1, t.o1), (2, t.s2, t.o2)) as x(slot, status, other)
)
insert into public.attendance
  (student_id, workshop_id, scanned_at, scanner_device_id, is_correct_workshop, manually_added)
select
  student_id, registered_id,
  now() - interval '3 hours' + (slot - 1) * interval '75 minutes' + n * interval '20 seconds',
  case when status = 'manual' then 'admin-dashboard' else 'test-phone-' || (n % 3 + 1) end,
  true, status = 'manual'
from slots
where status in ('present', 'manual', 'both')
union all
select
  sl.student_id, w.id,
  now() - interval '3 hours' + (sl.slot - 1) * interval '75 minutes' + sl.n * interval '20 seconds' + interval '5 minutes',
  'test-phone-' || (sl.n % 3 + 1),
  false, false
from slots sl
join public.workshops w on w.event_id = sl.event_id and w.time_slot = sl.slot and w.workshop_name = sl.other
where sl.status in ('wrong', 'both', 'walkin');

commit;

-- What was built.
select 'workshops' as what, count(*)::int as n from public.workshops where event_id = (select id from public.events where slug = 'test')
union all select 'students', count(*)::int from public.students where event_id = (select id from public.events where slug = 'test')
union all select 'attendance', count(*)::int from public.attendance where event_id = (select id from public.events where slug = 'test')
union all select 'supervisor addresses', count(distinct supervisor_email)::int from public.students where event_id = (select id from public.events where slug = 'test');
