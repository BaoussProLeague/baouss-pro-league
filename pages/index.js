import { useState } from "react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import FixtureRow from "../components/FixtureRow";
import GwStatusBar from "../components/GwStatusBar";
import TruncateText from "../components/TruncateText";
import RankArrow from "../components/RankArrow";

const CHIP_LABELS = { wildcard: "Wildcards", freehit: "Free Hits", bboost: "Bench Boosts", "3xc": "Triple Captains" };

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [fixtures, setFixtures] = useState(null);
  const [fixturesGw, setFixturesGw] = useState(null);
  const [table, setTable] = useState(null);

  const loadFixtures = (gw) => {
    const q = gw ? `?gw=${gw}` : "";
    fetch(`/api/fpl/fixtures${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !d.error && setFixtures(d))
      .catch(() => {});
  };

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/fpl/classic", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else { setData(d); setLastUpdated(new Date()); }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    fetch("/api/prizes/gw-snapshot", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !d.error && setSnapshot(d))
      .catch(() => {});

    loadFixtures(fixturesGw);

    fetch("/api/fpl/table", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !d.error && setTable(d.table))
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

      <GwStatusBar />

      {error && (
        <div className="card error">
          <p style={{ marginBottom: 10 }}>Couldn't load standings: {error}</p>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {loading && !error && <div className="card muted">Loading standings…</div>}

      <div className="grid">
        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span>{fixtures && fixtures.gwName ? fixtures.gwName : "This gameweek"} fixtures</span>
            {fixtures && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => { const g = fixtures.gw - 1; setFixturesGw(g); loadFixtures(g); }}
                  disabled={fixtures.gw <= fixtures.minGw}
                  style={{ padding: "4px 10px", fontSize: 13 }}
                >←</button>
                {!fixtures.isDefaultGw && (
                  <button
                    onClick={() => { setFixturesGw(null); loadFixtures(null); }}
                    style={{ padding: "4px 10px", fontSize: 11 }}
                  >Current</button>
                )}
                <button
                  onClick={() => { const g = fixtures.gw + 1; setFixturesGw(g); loadFixtures(g); }}
                  disabled={fixtures.gw >= fixtures.maxGw}
                  style={{ padding: "4px 10px", fontSize: 13 }}
                >→</button>
              </div>
            )}
          </h2>
          {fixtures && fixtures.fixtures.length > 0 && (() => {
            const kickoffs = fixtures.fixtures.map((f) => new Date(f.kickoff));
            const first = new Date(Math.min(...kickoffs));
            const last = new Date(Math.max(...kickoffs));
            const dateOpts = { weekday: "short", day: "numeric", month: "short" };
            const rangeLabel = first.toDateString() === last.toDateString()
              ? first.toLocaleDateString(undefined, dateOpts)
              : `${first.toLocaleDateString(undefined, dateOpts)} – ${last.toLocaleDateString(undefined, dateOpts)}`;
            const deadlineLabel = fixtures.deadline
              ? new Date(fixtures.deadline).toLocaleString(undefined, { ...dateOpts, hour: "2-digit", minute: "2-digit", hour12: false })
              : null;
            return (
              <div style={{ marginBottom: 10 }}>
                <p className="muted" style={{ fontSize: 13, marginBottom: 2 }}>{rangeLabel}</p>
                {deadlineLabel && <p className="muted" style={{ fontSize: 12 }}>Deadline: {deadlineLabel} <span style={{ fontSize: 10 }}>(your local time)</span></p>}
              </div>
            );
          })()}
          {!fixtures || fixtures.fixtures.length === 0 ? (
            <p className="muted">No fixtures found for this gameweek yet.</p>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {(() => {
                let lastDateKey = null;
                return fixtures.fixtures.map((f) => {
                  const kickoffDate = new Date(f.kickoff);
                  const dateKey = kickoffDate.toDateString();
                  const showHeader = dateKey !== lastDateKey;
                  lastDateKey = dateKey;
                  return (
                    <div key={f.id}>
                      {showHeader && (
                        <p style={{ fontSize: 11, color: "var(--muted-2)", textTransform: "uppercase", margin: "10px 0 4px", fontWeight: 600 }}>
                          {kickoffDate.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                        </p>
                      )}
                      <FixtureRow fixture={f} />
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        <div className="card">
          <h2>Premier League table</h2>
          {!table || table.length === 0 ? (
            <p className="muted">Table not available yet.</p>
          ) : (
            <div className="table-scroll" style={{ maxHeight: 260, overflowY: "auto" }}>
              <table>
                <thead>
                  <tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>
                </thead>
                <tbody>
                  {table.map((t, i) => (
                    <tr key={t.id}>
                      <td>{i + 1}</td>
                      <td>{t.shortName}</td>
                      <td>{t.played}</td>
                      <td>{t.win}</td>
                      <td>{t.draw}</td>
                      <td>{t.loss}</td>
                      <td>{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                      <td><strong>{t.points}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {leader && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 18 }}>
          <div className="stat"><div className="label">Gameweek</div><div className="value">{snapshot?.gw ?? "—"}</div></div>
          <div className="stat"><div className="label">Managers</div><div className="value">{data.standings.length}</div></div>
          <div className="stat" style={{ gridColumn: "span 2", minWidth: 0 }}>
            <div className="label">Currently leading</div>
            <div className="value" style={{ fontSize: 18, display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{leader.managerName}</span>
              <span style={{ color: "var(--accent-bright)", flexShrink: 0 }}>· {leader.totalPoints} pts</span>
            </div>
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
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Rank</th><th>Manager</th><th>Team</th><th>GW Pts</th><th>{data.currentMonthLabel || "Month"} Pts</th><th>Total Pts</th></tr>
                </thead>
                <tbody>
                  {data.standings.map((row) => (
                    <tr key={row.entry}>
                      <td>{row.rank}<RankArrow delta={row.lastRank ? (row.rank < row.lastRank ? "up" : row.rank > row.lastRank ? "down" : "same") : null} /></td>
                      <td><TruncateText text={row.managerName} maxWidth={140} href={`/team/${row.entry}`} /></td>
                      <td><TruncateText text={row.entryName} maxWidth={140} href={`/team/${row.entry}`} /></td>
                      <td>{row.gwPoints}</td>
                      <td>{row.monthPoints ?? "—"}</td>
                      <td><strong>{row.totalPoints}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
