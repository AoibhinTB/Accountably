-- Nudges: a "do your pact" poke from one member to another, scoped to a
-- specific period (today for daily pacts, this week for weekly pacts).
-- One row per (from, to, challenge, period) — repeated nudge taps are
-- idempotent at the DB level via the unique constraint.

create table public.nudges (
  id            uuid primary key default gen_random_uuid(),
  from_user_id  uuid not null references public.profiles(id) on delete cascade,
  to_user_id    uuid not null references public.profiles(id) on delete cascade,
  challenge_id  uuid not null references public.challenges(id) on delete cascade,
  period_start  date not null,
  created_at    timestamptz not null default now(),
  unique (from_user_id, to_user_id, challenge_id, period_start)
);

create index nudges_to_user_idx on public.nudges (to_user_id, period_start desc);
create index nudges_challenge_period_idx
  on public.nudges (challenge_id, period_start desc);

alter table public.nudges enable row level security;

-- SELECT: anyone in the challenge's group can see nudges within it.
create policy "nudges: group members can read"
  on public.nudges for select
  to authenticated
  using (
    exists (
      select 1
      from public.challenges c
      where c.id = nudges.challenge_id
        and public.is_group_member(c.group_id)
    )
  );

-- INSERT: from_user_id is filled by the BEFORE INSERT trigger (=auth.uid());
-- recipient must be a member of the pact too.
create policy "nudges: members can send"
  on public.nudges for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.challenges c
      where c.id = challenge_id
        and public.is_group_member(c.group_id)
    )
    and exists (
      select 1
      from public.group_members gm
      join public.challenges c on c.group_id = gm.group_id
      where c.id = challenge_id
        and gm.user_id = nudges.to_user_id
    )
  );

create or replace function public.set_nudge_from_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  new.from_user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_nudge_from_user_id_trigger on public.nudges;
create trigger set_nudge_from_user_id_trigger
  before insert on public.nudges
  for each row execute function public.set_nudge_from_user_id();
