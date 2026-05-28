-- Optional explicit avatar color override on profiles. Null means "derive
-- from the display name hash" (the current behaviour). Set to a 0-7 palette
-- index when the user picks one in edit profile.
alter table public.profiles
  add column if not exists avatar_color_index smallint
    check (avatar_color_index is null or (avatar_color_index >= 0 and avatar_color_index <= 7));
