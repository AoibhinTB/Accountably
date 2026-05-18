-- INSERT ... RETURNING on public.groups was failing with 42501. The SELECT
-- policy required the inserter to already be in group_members, but the
-- AFTER INSERT trigger that adds them (handle_new_group) runs after
-- RETURNING's SELECT-policy check. So at the moment the policy evaluated,
-- is_group_member(new.id) was false — Postgres surfaced this with the same
-- "new row violates row-level security policy" message used for INSERT
-- WITH CHECK failures, which sent debugging down the wrong path.
--
-- Allow creators to read their own group. created_by is set by the BEFORE
-- INSERT trigger, so it's already populated when RETURNING runs.

drop policy "groups: members can read" on public.groups;

create policy "groups: members can read"
  on public.groups for select
  to authenticated
  using (
    public.is_group_member(id)
    or created_by = auth.uid()
  );

-- Debug helpers from 20260518200000 and 20260518210000 are no longer needed.
drop function if exists public.debug_whoami();
drop function if exists public.debug_request_context();
