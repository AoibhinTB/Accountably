-- Master pact-reminder kill switch. Default true preserves the existing
-- behaviour (per-pact reminder_time fires when set). Flipping it off
-- suppresses every pact reminder for the user; per-pact times stay
-- configured and resume firing when the master is turned back on.
alter table public.profiles
  add column if not exists reminders_enabled boolean not null default true;
