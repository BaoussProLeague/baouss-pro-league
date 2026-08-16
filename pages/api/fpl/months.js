import { fpl } from "../../../lib/fpl";
import { buildMonthGwMap } from "../../../lib/monthCalendar";

export default async function handler(req, res) {
  try {
    const data = await fpl.bootstrap();
    const months = buildMonthGwMap(data.events);
    res.status(200).json({ months });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
