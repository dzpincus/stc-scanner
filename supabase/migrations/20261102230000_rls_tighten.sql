-- P0: tighten RLS. Phones (anon key) may only read the active event and write attendance
-- through the RPCs; admins (Google OAuth @stagethechange.org) manage everything.
-- Uses ALTER POLICY instead of DROP/CREATE so the migration is additive and re-runnable.
--
-- BREAKS mobile builds older than this change (they insert/delete attendance directly).

-- Admin = authenticated Supabase user whose email is on the org domain.
create or replace function public.is_admin()
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select coalesce(
    auth.role() = 'authenticated'
      and (auth.jwt() ->> 'email') ilike '%@stagethechange.org',
    false
  );
$$;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------- events
alter policy "Events are viewable by anyone" on public.events
  to anon, authenticated
  using (is_active or (select public.is_admin()));
alter policy "Events are updatable by authenticated admins" on public.events
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------- students
alter policy "Students are viewable by anyone" on public.students
  to anon, authenticated
  using (event_id = (select public.current_event_id()) or (select public.is_admin()));
alter policy "Students are insertable by anyone" on public.students
  to authenticated
  with check ((select public.is_admin()));
alter policy "Students are updatable by anyone" on public.students
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Students are deletable by admins" on public.students
  for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------- workshops
alter policy "Workshops are viewable by anyone" on public.workshops
  to anon, authenticated
  using (event_id = (select public.current_event_id()) or (select public.is_admin()));
alter policy "Workshops are insertable by anyone" on public.workshops
  to authenticated
  with check ((select public.is_admin()));
alter policy "Workshops are updatable by anyone" on public.workshops
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Workshops are deletable by admins" on public.workshops
  for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------- attendance
-- Phones read the active event; all phone writes go through upsert_attendance / delete_attendance.
alter policy "Attendance is viewable by anyone" on public.attendance
  to anon, authenticated
  using (event_id = (select public.current_event_id()) or (select public.is_admin()));
alter policy "Attendance is insertable by anyone" on public.attendance
  to authenticated
  with check ((select public.is_admin()));
alter policy "Attendance is updatable by anyone" on public.attendance
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
alter policy "Attendance is deletable by anyone" on public.attendance
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------- audit / admin-only tables
alter policy "Attendance history is viewable by anyone" on public.attendance_history
  to authenticated
  using ((select public.is_admin()));

alter policy "Email log is viewable by anyone" on public.email_log
  to authenticated
  using ((select public.is_admin()));
alter policy "Email log is insertable by anyone" on public.email_log
  to authenticated
  with check ((select public.is_admin()));

alter policy "Supervisors are viewable by anyone" on public.supervisors
  to authenticated using ((select public.is_admin()));
alter policy "Supervisors are insertable by anyone" on public.supervisors
  to authenticated with check ((select public.is_admin()));
alter policy "Supervisors are updatable by anyone" on public.supervisors
  to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

alter policy "Sync queue is manageable by anyone" on public.sync_queue
  to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- devices: phones heartbeat their own row (no PII); admins read.
alter policy "Devices are viewable by anyone" on public.devices
  to anon, authenticated using (true);
alter policy "Devices are insertable by anyone" on public.devices
  to anon, authenticated with check (true);
alter policy "Devices are updatable by anyone" on public.devices
  to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------- RPCs
-- upsert_attendance becomes SECURITY DEFINER (bypasses the table policies above) and
-- refuses rows whose student/workshop are not in the active event, so the anon key can
-- never write into an archived year.
create or replace function public.upsert_attendance(rows jsonb)
returns table (id uuid, status text, server_id uuid, detail text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  v_id uuid;
  v_student uuid;
  v_workshop uuid;
  v_returned uuid;
  v_event uuid := public.current_event_id();
begin
  if jsonb_typeof(rows) <> 'array' then
    raise exception 'rows must be a JSON array';
  end if;

  for r in select * from jsonb_array_elements(rows) loop
    begin
      v_id := (r ->> 'id')::uuid;
      v_student := (r ->> 'student_id')::uuid;
      v_workshop := (r ->> 'workshop_id')::uuid;
      v_returned := null;

      if not exists (select 1 from public.students s where s.id = v_student and s.event_id = v_event) then
        raise exception 'student is not in the active event';
      end if;
      if not exists (select 1 from public.workshops w where w.id = v_workshop and w.event_id = v_event) then
        raise exception 'workshop is not in the active event';
      end if;

      insert into public.attendance as a
        (id, student_id, workshop_id, scanned_at, scanner_device_id, is_correct_workshop,
         manually_added, manually_overridden, checked_out_at, notes, created_at, updated_at)
      values
        (v_id, v_student, v_workshop,
         coalesce((r ->> 'scanned_at')::timestamptz, now()),
         r ->> 'scanner_device_id',
         coalesce((r ->> 'is_correct_workshop')::boolean, true),
         coalesce((r ->> 'manually_added')::boolean, false),
         coalesce((r ->> 'manually_overridden')::boolean, false),
         (r ->> 'checked_out_at')::timestamptz,
         r ->> 'notes',
         coalesce((r ->> 'created_at')::timestamptz, now()),
         now())
      on conflict (student_id, workshop_id) do update set
        scanned_at = excluded.scanned_at,
        scanner_device_id = excluded.scanner_device_id,
        is_correct_workshop = excluded.is_correct_workshop,
        manually_added = excluded.manually_added,
        notes = coalesce(excluded.notes, a.notes),
        updated_at = now()
      where excluded.scanned_at < a.scanned_at
      returning a.id into v_returned;

      if v_returned is null then
        select a.id into v_returned from public.attendance a
          where a.student_id = v_student and a.workshop_id = v_workshop;
        if v_returned = v_id then
          return query select v_id, 'already_synced'::text, v_returned, null::text;
        else
          return query select v_id, 'duplicate'::text, v_returned, null::text;
        end if;
      elsif v_returned = v_id then
        return query select v_id, 'inserted'::text, v_returned, null::text;
      else
        return query select v_id, 'merged_earlier'::text, v_returned, null::text;
      end if;
    exception when others then
      return query select v_id, 'error'::text, null::uuid, sqlerrm;
    end;
  end loop;
end;
$$;
revoke all on function public.upsert_attendance(jsonb) from public;
grant execute on function public.upsert_attendance(jsonb) to anon, authenticated, service_role;

-- Roster "remove check-in" from phones. Active event only; audited by the attendance trigger.
create or replace function public.delete_attendance(ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.attendance a
    where a.id = any(ids) and a.event_id = public.current_event_id();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.delete_attendance(uuid[]) from public;
grant execute on function public.delete_attendance(uuid[]) to anon, authenticated, service_role;
