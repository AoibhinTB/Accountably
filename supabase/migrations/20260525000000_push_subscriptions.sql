-- Web Push subscriptions: one row per browser/device per user. Inserted when
-- a user opts in via the /you settings; deleted when they opt out or when
-- the push service returns 404/410 (subscription is dead).

create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- user_id is filled by the BEFORE INSERT trigger (=auth.uid()), matching
-- the pattern used for completions, reactions, and nudges.
create or replace function public.set_push_subscription_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_push_subscription_user_id_trigger
  on public.push_subscriptions;
create trigger set_push_subscription_user_id_trigger
  before insert on public.push_subscriptions
  for each row execute function public.set_push_subscription_user_id();

-- Users see and manage only their own subscriptions. The server-side
-- push sender uses the service role key, which bypasses RLS, so it can
-- read any user's subscriptions to deliver pushes to them.
create policy "push_subscriptions: own rows readable"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "push_subscriptions: own rows insertable"
  on public.push_subscriptions for insert
  to authenticated
  with check (true);  -- trigger enforces user_id = auth.uid()

create policy "push_subscriptions: own rows deletable"
  on public.push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);
