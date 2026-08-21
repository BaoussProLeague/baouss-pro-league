import { fpl } from "../../../../lib/fpl";

export default async function handler(req, res) {
  const { elementId } = req.query;
  if (!elementId) return res.status(400).json({ error: "elementId is required." });

  try {
    const bootstrap = await fpl.bootstrap();
    const el = bootstrap.elements.find((e) => e.id === Number(elementId));
    if (!el) return res.status(404).json({ error: "Player not found." });

    const team = bootstrap.teams.find((t) => t.id === el.team);
    const teamsById = new Map(bootstrap.teams.map((t) => [t.id, t]));

    const summary = await fpl.elementSummary(elementId);

    res.status(200).json({
      id: el.id,
      name: el.web_name,
      fullName: `${el.first_name} ${el.second_name}`,
      photoCode: el.photo ? el.photo.replace(".jpg", "") : null,
      teamName: team ? team.name : "",
      teamShort: team ? team.short_name : "",
      teamCode: team ? team.code : null,
      elementType: el.element_type,
      nowCost: el.now_cost / 10,
      totalPoints: el.total_points,
      form: el.form,
      pointsPerGame: el.points_per_game,
      selectedByPercent: el.selected_by_percent,
      goalsScored: el.goals_scored,
      assists: el.assists,
      cleanSheets: el.clean_sheets,
      goalsConceded: el.goals_conceded,
      yellowCards: el.yellow_cards,
      redCards: el.red_cards,
      saves: el.saves,
      bonus: el.bonus,
      bps: el.bps,
      minutes: el.minutes,
      status: el.status, // 'a' available, 'i' injured, 'd' doubtful, 's' suspended, 'u' unavailable
      news: el.news,
      history: summary.history.map((h) => ({
        gw: h.round,
        points: h.total_points,
        minutes: h.minutes,
        goals: h.goals_scored,
        assists: h.assists,
        opponent: teamsById.get(h.opponent_team)?.short_name || "",
        wasHome: h.was_home,
      })),
      upcomingFixtures: (summary.fixtures || []).slice(0, 5).map((f) => ({
        gw: f.event,
        opponent: teamsById.get(f.is_home ? f.team_a : f.team_h)?.short_name || "TBC",
        isHome: f.is_home,
        difficulty: f.difficulty,
        kickoff: f.kickoff_time,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
