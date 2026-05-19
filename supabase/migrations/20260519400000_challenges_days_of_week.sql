-- Pacts can now declare which days of the week they require. Day indices:
-- 0 = Monday ... 6 = Sunday. Nullable for backward-compat with existing
-- daily/weekly pacts; when present it is the source of truth for scheduling
-- (the frequency enum becomes a hint).

alter table public.challenges
  add column if not exists days_of_week int[];

alter table public.challenges
  drop constraint if exists challenges_days_of_week_check;

alter table public.challenges
  add constraint challenges_days_of_week_check
  check (
    days_of_week is null
    or (
      array_length(days_of_week, 1) between 1 and 7
      and days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]
    )
  );

-- create_pact RPC: accept the new optional days_of_week. Existing callers
-- that don't pass it continue to work.
create or replace function public.create_pact(
  p_name         text,
  p_frequency    text,
  p_start_date   date,
  p_end_date     date,
  p_description  text,
  p_icon         text default null,
  p_days_of_week int[] default null
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
    group_id, title, description, frequency, start_date, end_date, days_of_week
  ) values (
    gid,
    p_name,
    p_description,
    p_frequency::public.challenge_frequency,
    p_start_date,
    p_end_date,
    p_days_of_week
  );

  return gid;
end;
$$;

grant execute on function public.create_pact(text, text, date, date, text, text, int[]) to authenticated;
