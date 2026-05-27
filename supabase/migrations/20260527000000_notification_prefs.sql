-- Per-user notification preferences and the data the reminder cron needs to
-- know who to ping at what time, in what timezone, and whether it has
-- already fired today.
--
-- * notif_nudges      — gate for push when someone nudges this user
-- * notif_checkins    — gate for push when someone in a shared pact checks in
-- * reminder_time     — local-time-of-day to send "you have not checked in"
--                       (null = no reminder)
-- * reminder_timezone — IANA tz name; "what is now in your local clock?" is
--                       computed as (now() at time zone reminder_timezone)
-- * last_reminder_sent_date — last calendar date (in user-local tz) the
--                              reminder fired, so the hourly cron does not
--                              re-fire the same day.
alter table public.profiles
  add column if not exists notif_nudges boolean not null default true,
  add column if not exists notif_checkins boolean not null default true,
  add column if not exists reminder_time time,
  add column if not exists reminder_timezone text,
  add column if not exists last_reminder_sent_date date;
