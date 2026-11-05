-- Admins (Google OAuth, role = authenticated) may toggle event lock / rename.
-- Phones use the anon key and must never change events.
create policy "Events are updatable by authenticated admins"
  on public.events for update
  to authenticated
  using (true)
  with check (true);
