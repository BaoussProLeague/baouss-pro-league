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

export default function GwStatusBar() {
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

  if (!data) return null;

  return (
    <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "space-between" }}>
      {data.gw && (
        <div>
          <div className="label" style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted-2)", marginBottom: 6 }}>
            GW{data.gw} status
          </div>
          {data.days.length === 0 ? (
            <span className="pill admin">Not started yet</span>
          ) : data.finalized ? (
            <span className="pill alive">Confirmed - all bonus points final</span>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {data.days.map((d) => (
                <span key={d.date} className={d.bonusAdded ? "pill alive" : "pill admin"} style={{ fontSize: 11 }}>
                  {new Date(d.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}: {d.bonusAdded ? "Confirmed" : "Provisional"}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {countdown && data.nextGw && (
        <div>
          <div className="label" style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted-2)", marginBottom: 6, textAlign: "right" }}>
            GW{data.nextGw} deadline in
          </div>
          <div style={{ display: "flex", gap: 10, fontFamily: "monospace" }}>
            {[["D", countdown.days], ["H", countdown.hours], ["M", countdown.minutes], ["S", countdown.seconds]].map(([label, val]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{pad(val)}</div>
                <div style={{ fontSize: 10, color: "var(--muted-2)" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
