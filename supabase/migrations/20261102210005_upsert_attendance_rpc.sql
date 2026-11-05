-- Batch upload from phones. One round trip, one savepoint per row, earliest scan wins.
-- Statuses: inserted | merged_earlier (our earlier scan replaced the server row's scan fields)
--           | already_synced (same id already on server) | duplicate (another record won; server_id tells which)
--           | error (detail has the message). The client treats everything except 'error' as synced.
-- down: drop function upsert_attendance(jsonb);

create or replace function public.upsert_attendance(rows jsonb)
returns table (id uuid, status text, server_id uuid, detail text)
language plpgsql security invoker set search_path = ''
as $$
declare
  r jsonb;
  v_id uuid;
  v_student uuid;
  v_workshop uuid;
  v_returned uuid;
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

grant execute on function public.upsert_attendance(jsonb) to anon, authenticated, service_role;
