-- How many check-ins per period count as "done". Default 1 = current
-- behaviour (single tap, toggle on/off). Target > 1 turns the check-in
-- semantics into append-only so each tap adds a completion that counts
-- toward the target; the grid + circles fill proportionally.
alter table public.challenges
  add column if not exists target_per_period smallint not null default 1
    check (target_per_period >= 1 and target_per_period <= 24);
