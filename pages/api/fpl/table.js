import { fpl } from "../../../lib/fpl";

export default async function handler(req, res) {
  try {
    const bootstrap = await fpl.bootstrap();

    const table = bootstrap.teams
      .map((t) => ({
        id: t.id,
        name: t.name,
        shortName: t.short_name,
        code: t.code,
        position: t.position,
        played: t.played,
        win: t.win,
        draw: t.draw,
        loss: t.loss,
        points: t.points,
      }))
      // Pre-season, FPL's `position` field isn't meaningful yet (everyone's
      // at 0 played) - sort by points then alphabetically so the table
      // still renders sensibly instead of in a random order.
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

    res.status(200).json({ table });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
