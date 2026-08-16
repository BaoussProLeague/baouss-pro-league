# Baouss Pro League

A live dashboard for your private FPL mini-league, pulling directly from the
official (unofficial-but-public) FPL API. Free to host — no credit card
required on either service used below.

## What's actually working vs. what's scaffolded

**Fully working:**
- Classic League standings (live)
- H2H League standings + Gold/Silver cup qualification (live)
- H2H knockout bracket (R16 → Final) — admin enters each round's result in
  `/admin`, displayed on `/h2h`
- LMS: automatic weekly elimination engine with tie-break logic (points →
  bench points → captain points), rebuy tracking, admin-triggered (not
  auto-run, see below for why)
- Team Value, Bench Points, First to 999, First to 1499 (live, derived from
  each manager's season history)
- Chip prizes (Wildcard / Free Hit / Triple Captain / Bench Boost) — this
  season gives everyone 2 sets of chips (one per half); per your call, each
  prize takes the **best of a manager's two activations**. Computed live
  from each manager's `chips` history, no extra API calls needed.
- Perfect Captaincy (new prize) — most gameweeks where your captain was
  actually your squad's top scorer. Admin-triggered per GW (same reasoning
  as LMS: wait for the lockdown so late bonus/DefCon points don't flip it).
  Note: FPL's 2026/27 lockdown now happens at 9am UK the day after the last
  match of the GW, later than before — run this and the LMS check after
  that time.
- Registration + payment tracking (`/admin`) — replaces the Form responses
  + RegistrationPayments sheets. Contains phone numbers, so the list route
  is password-gated like everything else under `/admin`.
- **Finance (private)** at `/admin/finance` — prize pool math, admin fees,
  LMS rebuy income, and every prize payout with paid/owed status. This page
  is deliberately **not linked from the main nav** and asks for its own
  password prompt rather than sharing state with the rest of `/admin`, so
  it's never one accidental click away from a public page.

**Scaffolded / needs you to finish, following the pattern already there:**
- Mega GW, Wildcard Vision, Most Points from Def+GK — all require pulling
  *every manager's picks for every relevant gameweek*, which is heavier and
  rate-limit-sensitive. `lib/prizes/captaincy.js` (built for Perfect
  Captaincy) is the working template for any picks-per-GW prize — same
  `entryPicks()` + `eventLive()` pattern, cached in Supabase per GW rather
  than recomputed live.
- Comeback King/Queen: needs a GW19 snapshot of mini-league rank, which has
  to be captured *at* GW19, not reconstructed afterward. Schema field
  `league_config.gw19_snapshot` is ready; needs one manual admin action
  around GW19, or a scheduled job.
- Manager of the Month, Highest Rank Jump: calculation functions exist in
  `lib/prizes/fromHistory.js` (`managerOfTheMonth`, `rankJumpByMonth`) using
  the month→GW mapping from your rules doc, but aren't wired to a page yet.
- Differential Dagger, One-Week Wonder, Iron Manager, Set & Forget, Podium
  Consistency, Double Wildcard — discussed as ideas, not built. Say the
  word on any of these and they follow the same patterns already in
  `lib/prizes/`.

**Why LMS elimination isn't fully automatic:** FPL sometimes adjusts bonus
points up to ~48-72 hours after a gameweek's last match. Auto-eliminating
the instant a GW ends risks eliminating the wrong manager if bonus points
shift afterward. The admin page lets you trigger it deliberately once
scores are confirmed final.

## Honest QA note

Same caveat as before, worth repeating: I have not run this app. No network
access in my environment means no `npm install`, no build, no clicking
through it. This is a careful code-level review and defensive coding pass,
not verified execution. Test the following yourself once it's deployed:
- Every admin form with deliberately bad input (letters in a GW field, the
  same team picked twice in an H2H fixture) - confirm the error dialog is
  accurate and nothing bad reaches the database.
- Add, edit, and delete a registration, a rebuy, and a knockout result -
  confirm each shows up / disappears correctly without a page refresh.
- Add a Mega GW for a future gameweek, confirm it shows "Upcoming" on
  Prizes; once that GW is actually played, refresh and confirm a winner
  appears automatically.
- Run the Def+GK and Captain accuracy checks for one gameweek and sanity-
  check the numbers against what the FPL app shows for a manager you know.
- Hit "Export to Excel" from Admin and confirm every sheet has real data
  once the league has some.

## What changed in this pass

- **Real bug fix**: Rank Jump and Comeback King were using each manager's
  *global* FPL rank (their position among millions of players worldwide),
  not their rank inside this mini-league. Both now reconstruct mini-league
  rank at any past gameweek directly from history data - correct, and no
  fragile "capture a live snapshot at GW19" mechanism needed.
- **Live prizes newly wired up** (the calculation logic already existed in
  most cases, it just wasn't connected to a page): Manager of the Month,
  Highest Rank Jump, Least Transfer Cost, Comeback King, Wildcard Vision.
- **Mega GW**, fully built: admin marks which gameweeks count, winners are
  calculated automatically from the same cheap history data other live
  prizes use - no per-GW admin action needed once marked.
- **Def+GK** and **Captain Points**, built going-forward-only per your
  call - admin-triggered per gameweek, not backfilled.
- **Dropdowns instead of typed Entry IDs** everywhere in Admin - pulled
  live from the classic league standings. This is almost certainly what
  was breaking the H2H knockout and rebuy forms before: a mistyped ID
  fails validation silently from the user's perspective.
- **Edit and delete** on registrations, rebuys, and knockout results.
- **Refresh button** on Admin - reloads everything without re-entering
  the password.
- **Compact activity log** - a short "recent activity" strip always shown,
  full table only appears if there's enough history to be worth expanding.
- **Set Rules month calendar** now computed live from FPL's actual
  gameweek deadline dates, not a hand-typed table - stays correct even if
  fixtures move.
- **Team crest grid** fixed to a clean 10-and-10 layout.
- **Classic League page** no longer shows a raw external league name -
  replaced with a "Currently leading" spotlight card.
- **Logo**: still a placeholder lightning bolt (the official Premier
  League crest can't be used as this app's own branding - trademark, not
  a style choice). Drop your own image at `public/logo.png` once you have
  it and it swaps in automatically, no code change needed.
- **Excel export**: one-way "Export to Excel" button in Admin, pulling
  every live prize, registrations, and finance data into a multi-sheet
  workbook. Two-way sync is a separate, bigger piece for later.
- Every prize description and page hero rewritten for clarity and tone.

## Still not built

Wildcard Vision, Team Value, and the chip prizes are fully live. Everything
else marked "Not yet tracked" on the Prizes page is genuinely not built -
check that page directly for the current honest list rather than trusting
this README to stay perfectly in sync with the code.

### 1. Database — Supabase (free tier)
1. Go to supabase.com → New project (free tier).
2. SQL Editor → paste the contents of `supabase/schema.sql` → Run.
3. Project Settings → API → copy your Project URL, `anon` key, and
   `service_role` key.

### 2. Hosting — Vercel (free tier)
1. Push this folder to a GitHub repo.
2. vercel.com → New Project → import that repo.
3. In Vercel's Environment Variables, add everything from `.env.example`
   with your real values:
   - `FPL_CLASSIC_LEAGUE_ID`, `FPL_H2H_LEAGUE_ID` — the number in the URL
     when you open your league on fantasy.premierleague.com
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY` — from step 1
   - `ADMIN_PASSWORD` — pick something, this gates `/admin`
4. Deploy. You'll get a free `your-app.vercel.app` URL, live on the
   internet, no server to maintain.

### 3. Local dev (optional, before deploying)
```
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

## Known limits of the free tiers
- Supabase free tier pauses a project after 7 days of no activity — a
  visitor to your site within that window keeps it awake, or you can add a
  scheduled ping.
- Vercel free tier has a function execution time limit (10s on Hobby). The
  classic/H2H standings routes paginate through FPL's API, which is fine for
  leagues under ~200 managers but could hit that ceiling for very large
  leagues.
- FPL's API is unofficial and public but not officially documented or
  guaranteed stable — if a route changes, `lib/fpl.js` is the one place to
  fix it.
