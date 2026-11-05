-- Deleting a student or workshop must never silently destroy attendance or unassign students.
-- down: recreate the four constraints with ON DELETE CASCADE / SET NULL as in the initial schema.

alter table public.attendance drop constraint if exists attendance_student_id_fkey;
alter table public.attendance add constraint attendance_student_id_fkey
  foreign key (student_id) references public.students(id) on delete restrict;

alter table public.attendance drop constraint if exists attendance_workshop_id_fkey;
alter table public.attendance add constraint attendance_workshop_id_fkey
  foreign key (workshop_id) references public.workshops(id) on delete restrict;

alter table public.students drop constraint if exists fk_students_workshop_slot1;
alter table public.students add constraint fk_students_workshop_slot1
  foreign key (workshop_slot1_id) references public.workshops(id) on delete restrict;

alter table public.students drop constraint if exists fk_students_workshop_slot2;
alter table public.students add constraint fk_students_workshop_slot2
  foreign key (workshop_slot2_id) references public.workshops(id) on delete restrict;
