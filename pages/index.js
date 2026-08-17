import { useState } from "react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import TeamCrests from "../components/TeamCrests";

const CHIP_LABELS = { wildcard: "Wildcards", freehit: "Free Hits", bboost: "Bench Boosts", "3xc": "Triple Captains" };

export default function Home() {
  const [data, setData] = useState(null);
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/fpl/classic")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else { setData(d); setLastUpdated(new Date()); }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    fetch("/api/fpl/bootstrap")
      .then((r) => r.json())
      .then((d) => !d.error && setTeams(d.teams))
      .catch(() => {});

    fetch("/api/prizes/gw-snapshot")
      .then((r) => r.json())
      .then((d) => !d.error && setSnapshot(d))
      .catch(() => {});
  };

  useAutoRefresh(load, 60000);

  const leader = data && data.standings.length > 0 ? data.standings[0] : null;
  const maxCaptainCount = snapshot && snapshot.captainPickAggregate.length > 0 ? snapshot.captainPickAggregate[0].count : 1;

  return (
    <div className="container">
      <div className="hero">
        <h1>Classic League</h1>
        <p>Season-long standings, pulled live from the official FPL API. Highest overall score at the end of the season wins - top 8 places are paid, ties are resolved using Set Rules.</p>
        {lastUpdated && (
          <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted-2)" }}>
            Auto-refreshes every 60 seconds while this page is open · Last updated {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      <TeamCrests teams={teams} />

      {error && (
        <div className="card error">
          <p style={{ marginBottom: 10 }}>Couldn't load standings: {error}</p>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {loading && !error && <div className="card muted">Loading standings…</div>}

      {leader && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 18 }}>
          <div className="stat"><div className="label">Gameweek</div><div className="value">{snapshot?.gw ?? "—"}</div></div>
          <div className="stat"><div className="label">Managers</div><div className="value">{data.standings.length}</div></div>
          <div className="stat" style={{ gridColumn: "span 2" }}>
            <div className="label">Currently leading</div>
            <div className="value" style={{ fontSize: 18 }}>{leader.managerName} <span style={{ color: "var(--accent-bright)" }}>· {leader.totalPoints} pts</span></div>
          </div>
        </div>
      )}

      {snapshot && snapshot.gw && (
        <div className="grid">
          <div className="card">
            <h2>GW{snapshot.gw} captain picks</h2>
            {snapshot.captainPickAggregate.length === 0 ? (
              <p className="muted">No picks recorded yet for this gameweek.</p>
            ) : (
              <div>
                {snapshot.captainPickAggregate.slice(0, 8).map((c) => (
                  <div key={c.name} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span>{c.name}</span>
                      <span className="muted">{c.count} ({c.pct}%)</span>
                    </div>
                    <div style={{ background: "var(--bg-elevated)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                      <div style={{ width: `${(c.count / maxCaptainCount) * 100}%`, height: "100%", background: "linear-gradient(90deg, var(--purple), var(--accent-bright))" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Chips used this GW</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {Object.entries(CHIP_LABELS).map(([key, label]) => (
                <div className="stat" key={key}>
                  <div className="label">{label}</div>
                  <div className="value">{snapshot.chipsUsedThisGw ? snapshot.chipsUsedThisGw[key] : 0}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {data && !loading && (
        <div className="card">
          <h2>Full standings</h2>
          {data.standings.length === 0 ? (
            <p className="muted">No entries found for this league yet - once your real league ID is set and managers join, they'll show up here.</p>
          ) : (
            <div className="table-scroll"><table>
              <thead>
                <tr><th>Rank</th><th>Manager</th><th>Team</th><th>GW Pts</th><th>Total Pts</th></tr>
              </thead>
              <tbody>
                {data.standings.map((row) => (
                  <tr key={row.entry}>
                    <td>{row.rank}{row.lastRank && row.lastRank !== row.rank ? (row.rank < row.lastRank ? " ▲" : " ▼") : ""}</td>
                    <td>{row.managerName}</td>
                    <td>{row.entryName}</td>
                    <td>{row.gwPoints}</td>
                    <td><strong>{row.totalPoints}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}
    </div>
  );
}
