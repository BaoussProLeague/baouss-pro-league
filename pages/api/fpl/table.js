import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";

// Computed from actual fixture results, not read from FPL's own
// precomputed team fields - those turned out to lag behind real match
// state (a fixture is over well before FPL's team-level stats reflect
// it). A fixture "counts" toward the table once `finished_provisional`
// is true - the final score is locked in at that point; only bonus
// points still being calculated is not a reason to hold back a league
// table, which doesn't involve bonus points at all. This also gets us
// real goal difference, which reading team fields directly couldn't.
export default async function handler(req, res) {
  setNoCache(res);
  try {
    const bootstrap = await fpl.bootstrap();
    const allFixtures = await fpl.allFixtures();

    const stats = new Map(
      bootstrap.teams.map((t) => [
        t.id,
        { id: t.id, name: t.name, shortName: t.short_name, code: t.code,
          played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, points: 0 },
      ])
    );

    for (const f of allFixtures) {
      if (!f.finished_provisional) continue;
      const home = stats.get(f.team_h);
      const away = stats.get(f.team_a);
      if (!home || !away) continue;

      home.played += 1; away.played += 1;
      home.gf += f.team_h_score; home.ga += f.team_a_score;
      away.gf += f.team_a_score; away.ga += f.team_h_score;

      if (f.team_h_score > f.team_a_score) { home.win += 1; home.points += 3; away.loss += 1; }
      else if (f.team_a_score > f.team_h_score) { away.win += 1; away.points += 3; home.loss += 1; }
      else { home.draw += 1; away.draw += 1; home.points += 1; away.points += 1; }
    }

    const table = Array.from(stats.values())
      .map((t) => ({ ...t, gd: t.gf - t.ga }))
      .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));

    res.status(200).json({ table });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
