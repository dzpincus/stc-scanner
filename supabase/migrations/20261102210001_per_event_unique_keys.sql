-- Uniqueness becomes per event (registration ids may repeat across years).
-- NOTE: admin import must upsert on (event_id, registration_id) and (event_id, workshop_name, time_slot) from now on.
-- down: drop the two new constraints; add constraint students_registration_id_key unique (registration_id);
--       add constraint unique_workshop_name_time_slot unique (workshop_name, time_slot);

alter table public.students  drop constraint if exists students_registration_id_key;
alter table public.workshops drop constraint if exists unique_workshop_name_time_slot;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_event_registration_key') then
    alter table public.students add constraint students_event_registration_key unique (event_id, registration_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workshops_event_name_slot_key') then
    alter table public.workshops add constraint workshops_event_name_slot_key unique (event_id, workshop_name, time_slot);
  end if;
end $$;

