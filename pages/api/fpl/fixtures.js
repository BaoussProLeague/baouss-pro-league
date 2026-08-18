import { fpl } from "../../../lib/fpl";

export default async function handler(req, res) {
  try {
    const bootstrap = await fpl.bootstrap();
    const currentEvent = bootstrap.events.find((e) => e.is_current) || bootstrap.events.find((e) => e.is_next);
    if (!currentEvent) {
      return res.status(200).json({ gw: null, fixtures: [] });
    }
    const gw = currentEvent.id;

    const teamsById = new Map(
      bootstrap.teams.map((t) => [t.id, { name: t.name, shortName: t.short_name, code: t.code }])
    );

    const raw = await fpl.fixtures(gw);
    const fixtures = raw
      .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))
      .map((f) => ({
        id: f.id,
        kickoff: f.kickoff_time,
        started: f.started,
        finished: f.finished,
        minutes: f.minutes,
        home: teamsById.get(f.team_h) || { name: "TBC", shortName: "TBC" },
        away: teamsById.get(f.team_a) || { name: "TBC", shortName: "TBC" },
        homeScore: f.team_h_score,
        awayScore: f.team_a_score,
      }));

    res.status(200).json({ gw, gwName: currentEvent.name, fixtures });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
