-- Mirror the groups/challenges pattern: a BEFORE INSERT trigger fills
-- completions.user_id from auth.uid() so the app never sends it and the
-- INSERT policy's `user_id = auth.uid()` clause cannot fail due to a
-- mismatched client-supplied value.

create or replace function public.set_completion_user_id()
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

drop trigger if exists set_completion_user_id_trigger on public.completions;
create trigger set_completion_user_id_trigger
  before insert on public.completions
  for each row execute function public.set_completion_user_id();
