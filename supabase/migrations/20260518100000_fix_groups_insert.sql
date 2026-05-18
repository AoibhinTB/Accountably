-- The original INSERT policy on public.groups required the application to
-- send `created_by = auth.uid()` explicitly. In practice this was throwing
-- "new row violates row-level security policy for table groups" — even
-- when the caller was signed in — because the app-supplied value didn't
-- match auth.uid() in the DB session.
--
-- Move ownership off the policy and onto a BEFORE INSERT trigger that
-- forces `created_by := auth.uid()`. The app no longer sends created_by,
-- so it cannot get it wrong, and the policy reduces to "must be signed in".

drop policy if exists "groups: any user can create, must own" on public.groups;

create or replace function public.set_group_created_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  new.created_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_group_created_by_trigger on public.groups;
create trigger set_group_created_by_trigger
  before insert on public.groups
  for each row execute function public.set_group_created_by();

create policy "groups: authenticated users can create"
  on public.groups for insert
  to authenticated
  with check (auth.uid() is not null);
