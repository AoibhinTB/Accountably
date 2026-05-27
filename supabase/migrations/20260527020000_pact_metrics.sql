-- Optional per-pact metric: pages read, reps done, minutes spent, etc.
--
-- challenges.metric_kind     — null disables the metric entirely. "count"
--                              means an integer of whatever the user is
--                              tracking (pages, reps...). "minutes" means
--                              the integer is a duration in whole minutes.
-- challenges.metric_name     — display label for the value, mostly relevant
--                              for "count" (e.g. "pages"). For "minutes"
--                              the UI formats automatically.
-- completions.metric_value   — what was contributed for this check-in. Same
--                              unit as the pact's metric_kind. Nullable so a
--                              user can still check in without supplying a
--                              value (or for pacts with no metric).
alter table public.challenges
  add column if not exists metric_kind text check (metric_kind in ('count', 'minutes')),
  add column if not exists metric_name text;

alter table public.completions
  add column if not exists metric_value integer
    check (metric_value is null or metric_value >= 0);
