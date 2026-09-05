import { fpl } from "../../../lib/fpl";
import { supabaseAdmin } from "../../../lib/supabase";
import { getLiveGwScoresFromStandings, gwStatus, getEffectiveCurrentGw } from "../../../lib/prizes/liveScores";
import { setNoCache } from "../../../lib/noCacheHeaders";
import { isFplDownError } from "../../../lib/fplErrors";

const FIRST_H2H_GW = 2;
const LAST_H2H_GW = 30;

export default async function handler(req, res) {
  setNoCache(res);

  try {
    let fplUnavailable = false;
    let bootstrap = null;
    let currentGw = null;

    // If a specific GW was requested, we don't need FPL at all to know
    // which fixtures to show - only the live/final scores need it, and
    // those degrade gracefully below. Only the DEFAULT view (no GW
    // specified) genuinely needs a live call to know what "current"
    // means, and that's exactly where a cached fallback matters.
    if (req.query.gw) {
      currentGw = Number(req.query.gw);
    } else {
      try {
        bootstrap = await fpl.bootstrap();
        let eventStatusData = null;
        try {
          eventStatusData = await fpl.eventStatus();
        } catch {
          // getEffectiveCurrentGw falls back to finished+data_checked automatically
        }
        currentGw = getEffectiveCurrentGw(bootstrap.events, eventStatusData) || FIRST_H2H_GW;
        await supabaseAdmin.from("fpl_data_cache").upsert(
          { cache_key: "h2h_current_gw", data: { gw: currentGw }, updated_at: new Date().toISOString() },
          { onConflict: "cache_key" }
        );
      } catch (err) {
        if (!isFplDownError(err.message)) throw err;
        fplUnavailable = true;
        const { data: cached } = await supabaseAdmin
          .from("fpl_data_cache")
          .select("*")
          .eq("cache_key", "h2h_current_gw")
          .maybeSingle();
        currentGw = cached ? cached.data.gw : FIRST_H2H_GW;
      }
    }

    const displayGw = Math.min(Math.max(currentGw, FIRST_H2H_GW), LAST_H2H_GW);

    // Fixtures live entirely in our own database - always available
    // regardless of FPL's status.
    const { data: fixturesThisGw, error } = await supabaseAdmin
      .from("h2h_custom_fixtures")
      .select("*")
      .eq("gw", displayGw)
      .not("entry_id_2", "is", null); // exclude byes from the matchups view
    if (error) throw error;

    let nameById = new Map();
    let scoreById = new Map();
    let status = "upcoming";

    if (!bootstrap && !fplUnavailable) {
      try {
        bootstrap = await fpl.bootstrap();
      } catch (err) {
        if (!isFplDownError(err.message)) throw err;
        fplUnavailable = true;
      }
    }

    if (bootstrap) {
      const targetEvent = bootstrap.events.find((e) => e.id === displayGw);
      status = gwStatus(targetEvent);

      try {
        const leagueId = process.env.FPL_CLASSIC_LEAGUE_ID;
        const { entries: classicEntries } = await fpl.allClassicEntries(leagueId);
        nameById = new Map(classicEntries.map((e) => [e.entry, e.entry_name]));

        if (displayGw === currentGw && status !== "upcoming") {
          // Same fix as everywhere else: event_total can still carry
          // over the previous gameweek's number in the gap between
          // deadline and kickoff. Checking whether a match has actually
          // begun is what correctly forces 0-0 during that gap instead
          // of showing stale numbers.
          const gwFixtures = await fpl.fixtures(displayGw);
          const fixturesStarted = gwFixtures.some((f) => f.started);
          const liveScores = getLiveGwScoresFromStandings(classicEntries, fixturesStarted);
          scoreById = new Map(liveScores.map((s) => [s.entry, s.points]));
        } else if (displayGw < currentGw) {
          // A genuinely past gameweek - history is fully reliable here,
          // so pull each manager's actual final score for it instead of
          // showing empty dashes. Only for the managers who actually
          // appear in this gameweek's fixtures.
          const entryIds = new Set();
          (fixturesThisGw || []).forEach((m) => {
            entryIds.add(m.entry_id_1);
            entryIds.add(m.entry_id_2);
          });
          const histories = await Promise.all(
            Array.from(entryIds).map(async (entryId) => {
              try {
                const h = await fpl.entryHistory(entryId);
                const row = h.current.find((r) => r.event === displayGw);
                return { entryId, points: row ? row.points : null };
              } catch {
                return { entryId, points: null };
              }
            })
          );
          scoreById = new Map(histories.map((h) => [h.entryId, h.points]));
        }
      } catch (err) {
        if (!isFplDownError(err.message)) throw err;
        fplUnavailable = true;
      }
    }

    // Names and scores fall back gracefully to what's on the fixture
    // row itself / a placeholder - the fixture (who plays whom) still
    // shows even when FPL can't confirm names or scores right now.
    const matchups = (fixturesThisGw || []).map((m) => ({
      entry1: { id: m.entry_id_1, name: nameById.get(m.entry_id_1) || `Entry ${m.entry_id_1}`, points: scoreById.get(m.entry_id_1) ?? null },
      entry2: { id: m.entry_id_2, name: nameById.get(m.entry_id_2) || `Entry ${m.entry_id_2}`, points: scoreById.get(m.entry_id_2) ?? null },
    }));

    res.status(200).json({
      gw: displayGw,
      currentGw,
      firstGw: FIRST_H2H_GW,
      lastGw: LAST_H2H_GW,
      isCurrentGw: displayGw === currentGw,
      isDefaultGw: displayGw === Math.max(currentGw, FIRST_H2H_GW),
      status,
      matchups,
      fplUnavailable,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
