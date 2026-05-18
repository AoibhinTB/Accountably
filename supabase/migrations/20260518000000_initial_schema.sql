-- Accountably — initial schema
-- All tables live in `public`, all have RLS enabled, all access is gated on
-- group membership. The Supabase Data API exposes `public` by default, so
-- without RLS these tables would be readable by any authenticated user.

create extension if not exists pgcrypto;

-- =========================================================================
-- profiles
-- =========================================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: any authenticated user can read"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles: user can insert their own row"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles: user can update their own row"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile row when a new auth user signs up. Pulls
-- display_name from the signUp options.data payload.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- groups
-- =========================================================================
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references public.profiles(id) on delete restrict,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at  timestamptz not null default now()
);

alter table public.groups enable row level security;

-- =========================================================================
-- group_members
-- =========================================================================
create table public.group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);
create index group_members_group_idx on public.group_members (group_id);

alter table public.group_members enable row level security;

-- Helper: is the current user a member of `gid`? SECURITY DEFINER so it
-- bypasses RLS on group_members and can be called from policies on other
-- tables without recursive policy checks.
create function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = gid
      and user_id = auth.uid()
  );
$$;

-- Groups policies
create policy "groups: members can read"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id));

create policy "groups: any user can create, must own"
  on public.groups for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "groups: creator can update"
  on public.groups for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "groups: creator can delete"
  on public.groups for delete
  to authenticated
  using (created_by = auth.uid());

-- Auto-add the creator to group_members on insert.
create function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id)
  values (new.id, new.created_by);
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- group_members policies
create policy "group_members: members can read other members"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "group_members: user can leave a group"
  on public.group_members for delete
  to authenticated
  using (user_id = auth.uid());

-- Joins go through the security-definer function below, not direct INSERT.

-- Join a group by invite code. Returns the joined group's id.
create function public.join_group_with_invite_code(code text)
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

  select id into gid from public.groups where invite_code = code;
  if gid is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid())
  on conflict (group_id, user_id) do nothing;

  return gid;
end;
$$;

-- =========================================================================
-- challenges
-- =========================================================================
create type public.challenge_frequency as enum ('daily', 'weekly');

create table public.challenges (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  title       text not null,
  description text,
  created_by  uuid not null references public.profiles(id) on delete restrict,
  frequency   public.challenge_frequency not null,
  start_date  date not null,
  end_date    date,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index challenges_group_idx on public.challenges (group_id);

alter table public.challenges enable row level security;

create policy "challenges: group members can read"
  on public.challenges for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "challenges: group members can create, must own"
  on public.challenges for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.is_group_member(group_id)
  );

create policy "challenges: creator can update"
  on public.challenges for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "challenges: creator can delete"
  on public.challenges for delete
  to authenticated
  using (created_by = auth.uid());

-- =========================================================================
-- completions
-- =========================================================================
create table public.completions (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  note         text
);

create index completions_challenge_idx on public.completions (challenge_id);
create index completions_user_idx on public.completions (user_id);
create index completions_recent_idx on public.completions (completed_at desc);

alter table public.completions enable row level security;

create policy "completions: group members can read"
  on public.completions for select
  to authenticated
  using (
    exists (
      select 1
      from public.challenges c
      where c.id = completions.challenge_id
        and public.is_group_member(c.group_id)
    )
  );

create policy "completions: user can log their own for groups they belong to"
  on public.completions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.challenges c
      where c.id = completions.challenge_id
        and public.is_group_member(c.group_id)
    )
  );

create policy "completions: user can update their own"
  on public.completions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "completions: user can delete their own"
  on public.completions for delete
  to authenticated
  using (user_id = auth.uid());

-- =========================================================================
-- reactions
-- =========================================================================
create table public.reactions (
  id            uuid primary key default gen_random_uuid(),
  completion_id uuid not null references public.completions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  emoji         text not null,
  created_at    timestamptz not null default now(),
  unique (completion_id, user_id, emoji)
);

create index reactions_completion_idx on public.reactions (completion_id);

alter table public.reactions enable row level security;

create policy "reactions: group members can read"
  on public.reactions for select
  to authenticated
  using (
    exists (
      select 1
      from public.completions co
      join public.challenges ch on ch.id = co.challenge_id
      where co.id = reactions.completion_id
        and public.is_group_member(ch.group_id)
    )
  );

create policy "reactions: user can react in groups they belong to"
  on public.reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.completions co
      join public.challenges ch on ch.id = co.challenge_id
      where co.id = reactions.completion_id
        and public.is_group_member(ch.group_id)
    )
  );

create policy "reactions: user can remove their own"
  on public.reactions for delete
  to authenticated
  using (user_id = auth.uid());
