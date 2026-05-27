-- Move reminders from per-user (profiles) to per-pact-per-user (group_members).
-- Each membership row gets its own optional reminder, so a user with several
-- pacts can wire different times to each. The cron iterates these rows
-- directly and stamps last_reminder_sent_date locally to that membership.
alter table public.group_members
  add column if not exists reminder_time time,
  add column if not exists reminder_timezone text,
  add column if not exists last_reminder_sent_date date;

alter table public.profiles
  drop column if exists reminder_time,
  drop column if exists reminder_timezone,
  drop column if exists last_reminder_sent_date;
