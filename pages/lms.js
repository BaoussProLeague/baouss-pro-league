import { useState } from "react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import TruncateText from "../components/TruncateText";

export default function Lms() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/lms/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useAutoRefresh(load, 60000);

  return (
    <div className="container">
      <div className="hero">
        <h1>Last Manager Standing</h1>
        <p>A weekly knockout starting GW2 - lowest scorer each gameweek is eliminated until one manager remains. Eliminated on or before GW21? You can buy back in for ₹500 during the GW22-24 break, rejoining when play resumes at GW25.</p>
      </div>

      {error && (
        <div className="card error">
          <p style={{ marginBottom: 10 }}>Couldn't load LMS status: {error}</p>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {loading && !error && <div className="card muted">Loading LMS status…</div>}

      {data && data.stillAlive.length === 0 && data.eliminations.length === 0 && (
        <div className="card muted">LMS hasn't started yet - it kicks off from GW2.</div>
      )}

      {data && (
        <>
          <div className="card">
            <h2 style={{ display: "flex", alignItems: "center" }}>
              Still Alive ({data.stillAliveCount})
              {data.gwIsLive && <span className="pill alive" style={{ marginLeft: 8 }}>GW{data.currentGw} LIVE</span>}
            </h2>
            {data.gwIsLive && (
              <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                Live points below are informational only - who actually gets eliminated is only decided once GW{data.currentGw} is fully confirmed by FPL, not from this live view.
                {" "}Rows in red are currently tied for lowest - this can and will shift live as scores change.
              </p>
            )}
            <div className="table-scroll"><table>
              <thead><tr><th>Team</th><th>Status</th><th>GW{data.currentGw} Live Pts</th></tr></thead>
              <tbody>
                {(() => {
                  const withScores = data.stillAlive.filter((e) => e.currentGwPoints !== null);
                  const dangerScore = withScores.length > 0 ? Math.min(...withScores.map((e) => e.currentGwPoints)) : null;
                  return data.stillAlive.map((e) => {
                    const inDanger = dangerScore !== null && e.currentGwPoints === dangerScore;
                    return (
                      <tr key={e.entry} style={inDanger ? { color: "var(--danger)" } : undefined}>
                        <td><TruncateText text={e.entryName} maxWidth={200} href={`/team/${e.entry}`} /></td>
                        <td><span className={inDanger ? "pill out" : "pill alive"}>{inDanger ? "In Danger" : "Alive"}</span></td>
                        <td>{e.currentGwPoints ?? "—"}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table></div>
          </div>

          <div className="card">
            <h2>Eliminated</h2>
            <div className="table-scroll"><table>
              <thead><tr><th>GW Out</th><th>Team</th><th>Score</th><th>How it was decided</th><th>Rebuy Eligible</th><th>Rebought?</th></tr></thead>
              <tbody>
                {data.eliminations.map((e) => {
                  const rebuy = data.rebuys.find((r) => r.entry_id === e.entry_id);
                  const eligible = e.gw_eliminated <= 21;
                  const tieLabel = !e.tie_broken_by
                    ? "Clear lowest score"
                    : e.tie_broken_by === "random_draw"
                    ? `Random draw (tied with ${(e.tie_candidates || []).map((c) => c.entryName).join(", ")})`
                    : `Tie broken by ${e.tie_broken_by.replace("_", " ")}`;
                  return (
                    <tr key={e.entry_id}>
                      <td>{e.gw_eliminated}</td>
                      <td><TruncateText text={e.entry_name} maxWidth={160} href={`/team/${e.entry_id}`} /></td>
                      <td>{e.gw_score}</td>
                      <td style={{ fontSize: 12.5, color: "var(--muted)" }}><TruncateText text={tieLabel} maxWidth={220} /></td>
                      <td>{eligible ? "Yes" : "No"}</td>
                      <td>{rebuy && rebuy.paid ? "Yes (₹500 paid)" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </div>
  );
}
