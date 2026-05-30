-- Private per-user, per-pact journal entries. Used by the personal logbook
-- page so a user can record notes that only they see, separate from the
-- pact-shared notes attached to completions.
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pact_id uuid not null references public.groups(id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 5000),
  created_at timestamptz not null default now()
);

create index journal_entries_user_pact_idx
  on public.journal_entries (user_id, pact_id, created_at desc);

alter table public.journal_entries enable row level security;

create policy "journal: read own"
  on public.journal_entries for select
  to authenticated
  using (user_id = auth.uid());

create policy "journal: insert own"
  on public.journal_entries for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "journal: update own"
  on public.journal_entries for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "journal: delete own"
  on public.journal_entries for delete
  to authenticated
  using (user_id = auth.uid());

-- BEFORE INSERT trigger fills user_id from auth.uid() so the client never
-- has to pass it explicitly; mirrors how nudges + push_subscriptions work.
create or replace function public.set_journal_user_id()
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

drop trigger if exists set_journal_user_id_trigger on public.journal_entries;
create trigger set_journal_user_id_trigger
  before insert on public.journal_entries
  for each row execute function public.set_journal_user_id();
