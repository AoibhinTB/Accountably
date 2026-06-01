-- Optional default value applied to each new completion when the metric is
-- enabled. Lets a user with a habit like "20 minutes of reading" auto-fill
-- the metric on every check-in unless they explicitly override it.
alter table public.challenges
  add column if not exists default_metric_value integer
    check (default_metric_value is null or default_metric_value >= 0);
