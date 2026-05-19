-- Pacts can have an optional emoji icon (one short string). Stored on the
-- group row since groups and pacts are 1:1 after the merge. Length is
-- capped to prevent abuse — single emoji + ZWJ sequences fit comfortably.

alter table public.groups
  add column if not exists icon text;

alter table public.groups
  drop constraint if exists groups_icon_length_check;

alter table public.groups
  add constraint groups_icon_length_check
  check (icon is null or length(icon) <= 16);

-- Update create_pact to accept the optional icon. Re-creating the function
-- (signature changes, so the previous one stays around until it's dropped
-- explicitly; harmless since callers will resolve to the new overload).
create or replace function public.create_pact(
  p_name        text,
  p_frequency   text,
  p_start_date  date,
  p_end_date    date,
  p_description text,
  p_icon        text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.groups (name, icon) values (p_name, p_icon)
  returning id into gid;

  insert into public.challenges (
    group_id, title, description, frequency, start_date, end_date
  ) values (
    gid,
    p_name,
    p_description,
    p_frequency::public.challenge_frequency,
    p_start_date,
    p_end_date
  );

  return gid;
end;
$$;

grant execute on function public.create_pact(text, text, date, date, text, text) to authenticated;
