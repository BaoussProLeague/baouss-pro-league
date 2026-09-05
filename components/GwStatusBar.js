import { useState, useEffect } from "react";

function useCountdown(targetIso) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!targetIso) return;
    const target = new Date(targetIso).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setRemaining({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetIso]);
  return remaining;
}

function pad(n) { return String(n).padStart(2, "0"); }

export function GwStatusCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/fpl/gw-status", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => !d.error && setData(d))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!data || !data.gw) return null;

  return (
    <div className="card">
      <h2>GW{data.gw} status</h2>
      {data.days.length === 0 ? (
        <p className="muted">Not started yet.</p>
      ) : (
        <div className="table-scroll"><table>
          <thead><tr><th>Day</th><th>Status</th></tr></thead>
          <tbody>
            {data.days.map((d) => (
              <tr key={d.date}>
                <td>{new Date(d.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</td>
                <td><span className={d.bonusAdded ? "pill alive" : "pill admin"}>{d.bonusAdded ? "Confirmed" : "Provisional"}</span></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

export function DeadlineCountdownCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/fpl/gw-status", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => !d.error && setData(d))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const countdown = useCountdown(data?.nextDeadline);

  if (!data || !countdown || !data.nextGw) return null;

  return (
    <div className="card" style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <h2 style={{ fontSize: 15, letterSpacing: 1 }}>GW{data.nextGw} deadline in</h2>
      <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 16 }}>
        {[["Days", countdown.days], ["Hours", countdown.hours], ["Minutes", countdown.minutes], ["Seconds", countdown.seconds]].map(([label, val]) => (
          <div key={label} style={{ textAlign: "center", minWidth: 70 }}>
            <div style={{
              fontSize: 48, fontWeight: 800, fontFamily: "monospace",
              background: "linear-gradient(135deg, var(--accent), var(--accent-bright))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              textShadow: "0 0 30px rgba(240, 187, 74, 0.35)",
            }}>
              {pad(val)}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-2)", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
        {new Date(data.nextDeadline).toLocaleDateString(undefined, { day: "numeric", month: "short" })} at {new Date(data.nextDeadline).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} <span style={{ fontSize: 11 }}>(your local time)</span>
      </p>
    </div>
  );
}
