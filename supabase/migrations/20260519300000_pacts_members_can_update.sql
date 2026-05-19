-- Any member can edit a pact (name, icon, description, frequency, dates).
-- Deletion remains creator-only via the existing "groups: creator can delete"
-- and "challenges: creator can delete" policies + the UI gate.

drop policy if exists "groups: creator can update" on public.groups;
create policy "groups: members can update"
  on public.groups for update
  to authenticated
  using (public.is_group_member(id))
  with check (public.is_group_member(id));

drop policy if exists "challenges: creator can update" on public.challenges;
create policy "challenges: members can update"
  on public.challenges for update
  to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));
