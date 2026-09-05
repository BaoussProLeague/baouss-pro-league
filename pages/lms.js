import { useState } from "react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import TruncateText from "../components/TruncateText";
import ErrorCard from "../components/ErrorCard";

export default function Lms() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gwScores, setGwScores] = useState(null);
  const [gwScoresGw, setGwScoresGw] = useState(null);

  const loadGwScores = (gw) => {
    const q = gw ? `?gw=${gw}` : "";
    fetch(`/api/lms/gw-scores${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !d.error && setGwScores(d))
      .catch(() => {});
  };

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/lms/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    loadGwScores(gwScoresGw);
  };

  useAutoRefresh(load, 60000);

  return (
    <div className="container">
      <div className="hero">
        <h1>Last Manager Standing</h1>
        <p>A weekly knockout starting GW2 - lowest scorer each gameweek is eliminated until one manager remains. Eliminated on or before GW21? You can buy back in for ₹500 during the GW22-24 break, rejoining when play resumes at GW25.</p>
      </div>

      {error && <ErrorCard error={error} onRetry={load} label="load LMS status" />}

      {loading && !error && <div className="card muted">Loading LMS status…</div>}

      {data && data.stale && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <p className="muted" style={{ fontSize: 13 }}>Showing the last known alive/eliminated snapshot as of {new Date(data.staleSince).toLocaleString()} - FPL's own servers are temporarily unavailable, so live data can't be confirmed right now.</p>
        </div>
      )}

      {data && data.stillAliveCount === null && data.eliminations.length === 0 && (
        <div className="card muted">LMS hasn't started yet - it kicks off from GW2.</div>
      )}

      {data && (
        <>
          {data.stillAliveCount !== null ? (
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
          ) : (
            <div className="card muted">Who's currently still alive is temporarily unavailable - FPL's own servers are down, and no earlier snapshot exists yet to fall back on. The eliminated list below is unaffected, since it's already decided.</div>
          )}

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

          {gwScores && gwScores.gw && (
            <div className="card">
              <h2 style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span>GW{gwScores.gw} scores</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => { const g = gwScores.gw - 1; setGwScoresGw(g); loadGwScores(g); }}
                    disabled={gwScores.gw <= gwScores.minGw}
                    style={{ padding: "4px 10px", fontSize: 13 }}
                  >←</button>
                  <button
                    onClick={() => { const g = gwScores.gw + 1; setGwScoresGw(g); loadGwScores(g); }}
                    disabled={gwScores.gw >= gwScores.maxGw}
                    style={{ padding: "4px 10px", fontSize: 13 }}
                  >→</button>
                </div>
              </h2>
              <div className="table-scroll"><table>
                <thead><tr><th>Team</th><th>Score</th><th></th></tr></thead>
                <tbody>
                  {gwScores.scores.map((s) => (
                    <tr key={s.entry} style={s.eliminatedThisGw ? { color: "var(--danger)" } : undefined}>
                      <td><TruncateText text={s.entryName} maxWidth={200} href={`/team/${s.entry}?gw=${gwScores.gw}`} /></td>
                      <td>{s.points ?? "—"}</td>
                      <td>{s.eliminatedThisGw && <span className="pill out">Eliminated</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
