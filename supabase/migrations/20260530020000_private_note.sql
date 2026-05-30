-- Author-private alternative to completions.note. When set, the note is
-- intended only for the author's logbook and we never select it on
-- pact-shared surfaces (group notes feed, pact-detail history).
-- Column-level RLS is not native in Postgres, so we rely on application
-- code never reading this from group surfaces.
alter table public.completions
  add column if not exists private_note text;
