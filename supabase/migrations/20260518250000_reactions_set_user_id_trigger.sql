-- Mirror the groups/challenges/completions pattern: BEFORE INSERT trigger
-- fills reactions.user_id from auth.uid() so the app never sends it.

create or replace function public.set_reaction_user_id()
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

drop trigger if exists set_reaction_user_id_trigger on public.reactions;
create trigger set_reaction_user_id_trigger
  before insert on public.reactions
  for each row execute function public.set_reaction_user_id();
