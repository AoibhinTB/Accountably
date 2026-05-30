-- Per-membership timestamp of the last check-in push notification the
-- actor triggered for the pact. notifyCompletion checks this and skips
-- sending again if the previous send was within the last 10 minutes,
-- so a user cycling on/off does not spam their pact mates.
alter table public.group_members
  add column if not exists last_completion_notify_at timestamptz;
