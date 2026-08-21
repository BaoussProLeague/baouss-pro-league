import { fpl } from "../../../lib/fpl";
import { setNoCache } from "../../../lib/noCacheHeaders";

export default async function handler(req, res) {
  setNoCache(res);
  try {
    const data = await fpl.bootstrap();
    const currentEvent = data.events.find((e) => e.is_current) || data.events.find((e) => e.is_next);
    res.status(200).json({
      currentGw: currentEvent ? currentEvent.id : null,
      events: data.events.map((e) => ({
        id: e.id,
        name: e.name,
        deadline_time: e.deadline_time,
        finished: e.finished,
        is_current: e.is_current,
      })),
      teams: data.teams.map((t) => ({ id: t.id, name: t.name, short_name: t.short_name, code: t.code })),
      // trimmed player fields - full elements list is large, only send what the UI needs
      elements: data.elements.map((p) => ({
        id: p.id,
        web_name: p.web_name,
        team: p.team,
        element_type: p.element_type, // 1=GK 2=DEF 3=MID 4=FWD
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
