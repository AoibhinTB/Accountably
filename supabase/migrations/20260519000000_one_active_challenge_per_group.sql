-- Pacts model: each group has exactly one active (non-archived) challenge.
-- Step 1: dedupe — for any group with multiple active challenges, keep the
-- most recent and archive the rest.
with ranked as (
  select id,
         row_number() over (
           partition by group_id
           order by created_at desc, id desc
         ) as rn
  from public.challenges
  where archived = false
)
update public.challenges c
set archived = true
from ranked r
where c.id = r.id
  and r.rn > 1;

-- Step 2: enforce the invariant with a partial unique index. Any future
-- attempt to insert/unarchive a second active challenge for the same group
-- raises a unique-violation error.
create unique index if not exists challenges_one_active_per_group
  on public.challenges (group_id)
  where archived = false;
