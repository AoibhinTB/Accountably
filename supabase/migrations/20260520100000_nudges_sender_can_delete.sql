-- Allow the sender to retract a nudge (un-nudge).
create policy "nudges: sender can remove"
  on public.nudges for delete
  to authenticated
  using (from_user_id = auth.uid());
