-- Mirror the groups pattern: have a BEFORE INSERT trigger populate
-- challenges.created_by from auth.uid() so the app never sends it and the
-- existing INSERT policy's `created_by = auth.uid()` clause cannot fail
-- due to a mismatched value from the client.

create or replace function public.set_challenge_created_by()
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

drop trigger if exists set_challenge_created_by_trigger on public.challenges;
create trigger set_challenge_created_by_trigger
  before insert on public.challenges
  for each row execute function public.set_challenge_created_by();
