-- Re-nudges: drop the per-period uniqueness so a sender can nudge the same
-- recipient multiple times in one period. The 5-minute cooldown is enforced
-- in the server action (sendNudge). Indexes on (to_user_id, period_start)
-- and (challenge_id, period_start) stay — they still serve the "any nudges
-- to me this period?" and pact-detail lookups.
--
-- Postgres auto-names unique constraints by column list and truncates to 63
-- chars, so we look up the constraint by table + type rather than rely on
-- the exact generated name.
do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.nudges'::regclass
    and contype = 'u';
  if c is not null then
    execute format('alter table public.nudges drop constraint %I', c);
  end if;
end $$;
