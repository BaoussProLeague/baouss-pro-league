-- Run this once in Supabase -> SQL Editor -> New query.
-- Every line is safe even if the column already exists - "add column if
-- not exists" is a no-op in that case, never an error. This exists
-- because "create table if not exists" (used in the main schema.sql)
-- does NOT retroactively add new columns to a table that was already
-- created in an earlier session - that's the actual root cause behind
-- the last three errors (h2h_custom_fixtures missing entirely, then
-- tie_broken_by missing from lms_eliminations, then captain_accuracy's
-- multiplier columns missing too). This script closes that whole class
-- of bug in one pass instead of finding each gap one at a time.

alter table lms_eliminations add column if not exists round int not null default 1;
alter table lms_eliminations add column if not exists tie_broken_by text;
alter table lms_eliminations add column if not exists tie_candidates jsonb;

alter table captain_accuracy add column if not exists captain_awarded_points int;
alter table captain_accuracy add column if not exists captain_multiplier int;

alter table prize_pool_config add column if not exists lms_rebuy_income_inr numeric default 0;

-- If h2h_custom_fixtures wasn't created yet (the earlier error), this
-- creates it now - safe to run even if you already added it separately.
create table if not exists h2h_custom_fixtures (
  id bigint generated always as identity primary key,
  round int not null,
  gw int not null,
  entry_id_1 bigint not null,
  entry_id_2 bigint,
  created_at timestamptz default now()
);
create index if not exists idx_h2h_custom_fixtures_gw on h2h_custom_fixtures(gw);
