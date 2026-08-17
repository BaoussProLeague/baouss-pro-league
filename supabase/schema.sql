-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)

-- Tracks each manager's LMS status week by week. Populated by the LMS
-- calculation job (pages/api/lms/status.js), not entered by hand.
create table if not exists lms_eliminations (
  id bigint generated always as identity primary key,
  entry_id bigint not null,           -- FPL manager (entry) id
  entry_name text not null,
  gw_eliminated int not null,
  gw_score int not null,              -- score that got them eliminated
  round int not null default 1,       -- 1 = original run, 2 = post-rebuy run (from GW25)
  tie_broken_by text,                 -- null if no tie; else 'bench_points' | 'captain_points' | 'random_draw'
  tie_candidates jsonb,               -- who else was tied, for a transparent audit trail on random draws
  created_at timestamptz default now(),
  unique (entry_id, round)
);

-- Manual admin action: who paid the INR 500 rebuy fee to re-enter LMS
-- after being eliminated on or before GW21.
create table if not exists lms_rebuys (
  id bigint generated always as identity primary key,
  entry_id bigint not null unique,
  entry_name text not null,
  paid boolean not null default false,
  paid_at timestamptz,
  amount_inr int not null default 500,
  notes text
);

-- Manual admin action: results of the H2H Gold/Silver knockout rounds.
-- FPL's H2H league object doesn't know about your custom bracket split
-- (top 16 -> Gold, 17-32 -> Silver) so results are recorded here as each
-- round finishes.
create table if not exists h2h_knockout_results (
  id bigint generated always as identity primary key,
  cup text not null check (cup in ('gold', 'silver')),
  round text not null check (round in ('r16', 'qf', 'sf', 'final')),
  gw int not null,
  entry_id_1 bigint not null,
  entry_id_2 bigint not null,
  score_1 int,
  score_2 int,
  winner_entry_id bigint,
  created_at timestamptz default now()
);

-- Single-row table holding league-wide config that can change without a
-- redeploy (league IDs, current admin-confirmed GW, etc.)
create table if not exists league_config (
  id int primary key default 1,
  classic_league_id bigint,
  h2h_league_id bigint,
  gw19_snapshot jsonb,   -- captured automatically for Comeback King calc
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into league_config (id) values (1) on conflict (id) do nothing;

-- =========================================================================
-- Registration & payment tracking (replaces the Form responses /
-- RegistrationPayments sheets). Admin-entered or synced from a form.
-- =========================================================================
create table if not exists registrations (
  id bigint generated always as identity primary key,
  manager_name text not null,
  phone text,
  fpl_team_name text,
  entry_id bigint,                 -- FPL entry id once known - links to live data
  payment_mode text check (payment_mode in ('upi_neft', 'paypal')),
  amount numeric,
  currency text check (currency in ('INR', 'USD')),
  paid_to text,                    -- which admin collected it (Siddhant, Shiv, etc.)
  paid boolean not null default false,
  paid_at timestamptz,
  code_shared boolean default false, -- did they get the league join code
  notes text,
  created_at timestamptz default now()
);

-- =========================================================================
-- Finance / prize payouts - ADMIN ONLY DATA. Never expose these tables or
-- their API routes to unauthenticated requests - gated by ADMIN_PASSWORD
-- in every route that touches them. Public dashboard pages must never
-- import from these tables.
-- =========================================================================
create table if not exists prize_pool_config (
  id int primary key default 1,
  total_players int,
  buyin_inr numeric,
  buyin_usd numeric,
  admin_fees_inr numeric default 0,
  lms_rebuy_income_inr numeric default 0,
  notes text,
  updated_at timestamptz default now(),
  constraint single_row_pool check (id = 1)
);
insert into prize_pool_config (id) values (1) on conflict (id) do nothing;

create table if not exists prize_payouts (
  id bigint generated always as identity primary key,
  prize_key text not null unique,   -- e.g. 'classic_rank_1', 'lms_winner', 'motm_aug'
  prize_label text not null,        -- e.g. 'Classic League - Rank 1'
  winner_entry_id bigint,
  winner_name text not null,
  amount numeric not null,
  currency text default 'INR',
  assigned_admin text,              -- who is responsible for paying this out
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- =========================================================================
-- Captain accuracy tracking (for the Perfect Captaincy prize). Populated
-- incrementally, one GW at a time, by an admin-triggered job - same
-- reasoning as LMS: wait for the GW to lock before recording it.
-- =========================================================================
create table if not exists captain_accuracy (
  id bigint generated always as identity primary key,
  entry_id bigint not null,
  entry_name text not null,
  gw int not null,
  captain_element_id int,
  captain_points int,
  was_top_scorer_in_squad boolean not null,
  created_at timestamptz default now(),
  unique (entry_id, gw)
);

-- =========================================================================
-- Persistent admin activity log. Every admin action writes here so the
-- log survives a page refresh (unlike client-side-only state) and gives
-- you a real audit trail of who ran what, when.
-- =========================================================================
create table if not exists admin_activity_log (
  id bigint generated always as identity primary key,
  action text not null,             -- e.g. 'lms_elimination', 'registration_added'
  summary text not null,            -- human-readable one-liner
  detail jsonb,                     -- full payload for debugging
  success boolean not null default true,
  created_at timestamptz default now()
);
create table if not exists mega_gws (
  id bigint generated always as identity primary key,
  gw int not null unique,
  label text not null,
  prize_amount_inr numeric,
  created_at timestamptz default now()
);

-- =========================================================================
-- Def+GK points log - genuinely needs per-manager-per-GW picks data, so
-- it's admin-triggered one gameweek at a time, going forward only.
-- =========================================================================
create table if not exists def_gk_points_log (
  id bigint generated always as identity primary key,
  entry_id bigint not null,
  entry_name text not null,
  gw int not null,
  points int not null default 0,
  created_at timestamptz default now(),
  unique (entry_id, gw)
);

-- =========================================================================
-- H2H knockout bracket - admin enters each round's result as it happens.
-- (h2h_knockout_results table already defined above.)
-- =========================================================================
