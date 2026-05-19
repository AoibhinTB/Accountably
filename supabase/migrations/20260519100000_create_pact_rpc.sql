-- Atomic pact creation: one transaction, both the group and its active
-- challenge. Same call path as the rest of the app (RLS via auth.uid()
-- inside SECURITY DEFINER, BEFORE INSERT triggers fill created_by, the
-- AFTER INSERT trigger on groups adds the creator to group_members).

create or replace function public.create_pact(
  p_name        text,
  p_frequency   text,
  p_start_date  date,
  p_end_date    date,
  p_description text
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

  insert into public.groups (name) values (p_name)
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

grant execute on function public.create_pact(text, text, date, date, text) to authenticated;
