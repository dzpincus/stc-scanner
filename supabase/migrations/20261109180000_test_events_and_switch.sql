-- Test datasets and one-call event switching.
--
-- events.is_test tags a dataset as test data. The admin shows a banner while a test event is
-- active, and the email route prefixes subjects with [TEST], BCCs only the sender and refuses
-- recipients outside @stagethechange.org.
--
-- set_active_event(slug) flips the single active event atomically. The admin and every phone
-- follow events.is_active, so this is the one switch for "which dataset is live".
-- Refused while the current event is locked (doors open).
--
-- SQL editor usage:  select slug, is_active from public.set_active_event('test');
--
-- down: drop function public.set_active_event(text); alter table public.events drop column is_test;

alter table public.events add column if not exists is_test boolean not null default false;
comment on column public.events.is_test is 'Test dataset. Emails are subject-prefixed [TEST], BCC only the sender, and only go to @stagethechange.org.';

create or replace function public.set_active_event(p_slug text)
returns public.events
language plpgsql security invoker set search_path = ''
as $$
declare
  v_current public.events;
  v_target public.events;
begin
  -- Admins from the dashboard, service role from API routes, postgres from the SQL editor.
  if not (current_user in ('postgres', 'supabase_admin', 'service_role') or (select public.is_admin())) then
    raise exception 'Only admins can switch the active event' using errcode = '42501';
  end if;

  select * into v_target from public.events where slug = p_slug;
  if not found then
    raise exception 'No event with slug "%"', p_slug;
  end if;

  select * into v_current from public.events where is_active for update;
  if v_current.id = v_target.id then
    return v_target;
  end if;
  if v_current.locked then
    raise exception 'Event "%" is locked (event mode). Unlock it before switching events.', v_current.name;
  end if;

  -- Two statements: the one-active-event unique index is checked per row, not per statement.
  update public.events set is_active = false where is_active;
  update public.events set is_active = true where id = v_target.id returning * into v_target;
  return v_target;
end;
$$;

revoke execute on function public.set_active_event(text) from public, anon;
grant execute on function public.set_active_event(text) to authenticated, service_role;
