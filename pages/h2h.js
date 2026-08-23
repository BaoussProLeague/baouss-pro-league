import { useState } from "react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import TruncateText from "../components/TruncateText";
import RankArrow from "../components/RankArrow";

const ROUND_LABELS = { r16: "Round of 16", qf: "Quarter-Final", sf: "Semi-Final", final: "Final" };

export default function H2H() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [knockout, setKnockout] = useState(null);
  const [matchups, setMatchups] = useState(null);
  const [matchupsGw, setMatchupsGw] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMatchups = (gw) => {
    const q = gw ? `?gw=${gw}` : "";
    fetch(`/api/h2h/matchups${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !d.error && setMatchups(d))
      .catch(() => {});
  };

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/fpl/h2h", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    fetch("/api/h2h/knockout", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !d.error && setKnockout(d))
      .catch(() => {});

    loadMatchups(matchupsGw);
  };

  useAutoRefresh(load, 60000);

  const entryName = (id) => {
    if (!data) return `Entry ${id}`;
    const row = data.standings.find((s) => s.entry === id);
    return row ? row.entryName : `Entry ${id}`;
  };

  const h2hStage = (gw) => {
    if (!gw) return null;
    if (gw <= 30) return "Group stage";
    if (gw <= 32) return "Round of 16";
    if (gw <= 34) return "Quarter-Finals";
    if (gw <= 36) return "Semi-Finals";
    return "Finals";
  };

  return (
    <div className="container">
      <div className="hero">
        <h1>Head-to-Head League</h1>
        <p>Every manager plays a group stage of 29 random fixtures through GW30. The top 32 split into a Gold Cup (ranks 1-16) and a Silver Cup (ranks 17-32), then straight knockout: Round of 16 at GW32, Quarter-Finals GW34, Semi-Finals GW36, both Finals on GW38.</p>
        {data && data.currentGw && (
          <p style={{ marginTop: 8 }}>
            <span className="pill admin">Currently: {h2hStage(data.currentGw)}</span>
            {data.groupStageOver && (
              <span className="pill alive" style={{ marginLeft: 8 }}>
                Group stage locked - final GW{data.groupStageSnapshotGw} standings
              </span>
            )}
          </p>
        )}
      </div>

      {error && (
        <div className="card error">
          <p style={{ marginBottom: 10 }}>Couldn't load H2H data: {error}</p>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {loading && !error && <div className="card muted">Loading H2H standings…</div>}

      {data && data.fixturesGenerated === false && (
        <div className="card muted" style={{ borderColor: "var(--accent)", padding: "12px 20px" }}>
          H2H fixtures haven't been generated yet - ask an admin to set up the season schedule.
        </div>
      )}

      {data && data.fixturesGenerated !== false && (
        <>
          {!data.hasStarted && (
            <div className="card muted" style={{ borderColor: "var(--accent)", padding: "12px 20px" }}>
              Scoring starts in GW2.
            </div>
          )}

          {data.groupStageOver && (
            <div className="card muted" style={{ borderColor: "var(--accent)" }}>
              The group stage ended at GW{data.groupStageSnapshotGw}. Everything below is permanently frozen at that point - later gameweeks don't affect qualification anymore, even though FPL's own H2H league keeps scoring fixtures behind the scenes.
            </div>
          )}

          {matchups && (
            <div className="card">
              <h2 style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span>
                  GW{matchups.gw} matchups
                  {matchups.isCurrentGw && matchups.status === "live" && <span className="pill alive" style={{ marginLeft: 8 }}>LIVE</span>}
                  {!matchups.isCurrentGw && <span className="pill admin" style={{ marginLeft: 8 }}>{matchups.gw > matchups.currentGw ? "Upcoming" : "Past"}</span>}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => { const g = matchups.gw - 1; setMatchupsGw(g); loadMatchups(g); }}
                    disabled={matchups.gw <= matchups.firstGw}
                    style={{ padding: "4px 10px", fontSize: 13 }}
                  >←</button>
                  <span className="muted" style={{ fontSize: 12 }}>{matchups.matchups.length} fixture{matchups.matchups.length !== 1 ? "s" : ""}</span>
                  <button
                    onClick={() => { const g = matchups.gw + 1; setMatchupsGw(g); loadMatchups(g); }}
                    disabled={matchups.gw >= matchups.lastGw}
                    style={{ padding: "4px 10px", fontSize: 13 }}
                  >→</button>
                </div>
              </h2>
              {matchups.matchups.length === 0 ? (
                <p className="muted">
                  {matchups.gw < matchups.firstGw
                    ? "No fixtures - the schedule starts at GW2."
                    : "No fixtures found for this gameweek - has the H2H schedule been generated yet? Ask an admin to check."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {matchups.matchups.map((m, i) => {
                    const p1 = m.entry1.points, p2 = m.entry2.points;
                    const leading1 = p1 !== null && p2 !== null && p1 > p2;
                    const leading2 = p1 !== null && p2 !== null && p2 > p1;
                    return (
                      <div
                        key={i}
                        style={{
                          background: "var(--bg-elevated)", borderRadius: 10, padding: "14px 16px",
                          display: "grid", gridTemplateColumns: "100px auto 100px", alignItems: "center", gap: 12,
                        }}
                      >
                        <div style={{ textAlign: "right" }}>
                          <TruncateText text={m.entry1.name} fixedWidth={100} href={`/team/${m.entry1.id}`} />
                        </div>
                        <div style={{
                          fontSize: 15, fontWeight: 700, flexShrink: 0, padding: "4px 12px",
                          borderRadius: 8, background: "var(--panel)", whiteSpace: "nowrap",
                        }}>
                          <span style={{ color: leading1 ? "var(--accent-bright)" : "var(--text)" }}>{p1 ?? "–"}</span>
                          <span style={{ color: "var(--muted-2)", margin: "0 4px" }}>:</span>
                          <span style={{ color: leading2 ? "var(--accent-bright)" : "var(--text)" }}>{p2 ?? "–"}</span>
                        </div>
                        <div>
                          <TruncateText text={m.entry2.name} fixedWidth={100} href={`/team/${m.entry2.id}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid">
            <div className="card">
              <h2>Gold Cup Qualifiers (Rank 1-16)</h2>
              {!data.hasStarted && <p className="muted" style={{ marginBottom: 10 }}>Scoring starts in GW2.</p>}
              <div className="table-scroll"><table>
                <thead><tr><th>Rank</th><th>Team</th></tr></thead>
                <tbody>
                  {data.cupQualification.gold.map((e) => (
                    <tr key={e.entry}><td>{e.rank}</td><td><TruncateText text={e.entryName} maxWidth={180} href={`/team/${e.entry}`} /></td></tr>
                  ))}
                </tbody>
              </table></div>
            </div>
            <div className="card">
              <h2>Silver Cup Qualifiers (Rank 17-32)</h2>
              {!data.hasStarted ? (
                <p className="muted" style={{ marginBottom: 10 }}>Scoring starts in GW2.</p>
              ) : data.cupQualification.silver.length === 0 ? (
                <p className="muted" style={{ marginBottom: 10 }}>Fewer than 17 managers have a ranked H2H record yet - Silver fills in as more matches are played.</p>
              ) : null}
              <div className="table-scroll"><table>
                <thead><tr><th>Rank</th><th>Team</th></tr></thead>
                <tbody>
                  {data.cupQualification.silver.map((e) => (
                    <tr key={e.entry}><td>{e.rank}</td><td><TruncateText text={e.entryName} maxWidth={180} href={`/team/${e.entry}`} /></td></tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </div>

          <div className="card">
            <h2>{data.groupStageOver ? `Final Group Table (GW${data.groupStageSnapshotGw})` : "Group Table (live)"}</h2>
            {!data.hasStarted && <p className="muted" style={{ marginBottom: 10 }}>Scoring starts in GW2.</p>}
            <div className="table-scroll"><table>
              <thead>
                <tr><th>Rank</th><th>Team</th><th>W</th><th>D</th><th>L</th><th>Pts</th></tr>
              </thead>
              <tbody>
                {data.standings.map((row) => (
                  <tr key={row.entry}>
                    <td>{row.rank}<RankArrow delta={row.delta} /></td><td><TruncateText text={row.entryName} maxWidth={160} href={`/team/${row.entry}`} /></td>
                    <td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td><td><strong>{row.points}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>

          <div className="grid">
            {["gold", "silver"].map((cup) => (
              <div className="card" key={cup}>
                <h2>{cup === "gold" ? "Gold Cup" : "Silver Cup"} Knockout Bracket</h2>
                {!knockout || knockout[cup].length === 0 ? (
                  <p className="muted">
                    {data.groupStageOver
                      ? "No rounds recorded yet - admin adds each fixture and result as the knockout progresses."
                      : "Knockout fixtures open up once the group stage ends at GW30."}
                  </p>
                ) : (
                  <div className="table-scroll"><table>
                    <thead><tr><th>Round</th><th>GW</th><th>Fixture</th><th>Score</th></tr></thead>
                    <tbody>
                      {knockout[cup].map((r) => (
                        <tr key={r.id}>
                          <td>{ROUND_LABELS[r.round] || r.round}</td>
                          <td>{r.gw}</td>
                          <td><TruncateText text={entryName(r.entry_id_1)} maxWidth={100} href={`/team/${r.entry_id_1}`} /> vs <TruncateText text={entryName(r.entry_id_2)} maxWidth={100} href={`/team/${r.entry_id_2}`} /></td>
                          <td>{r.score_1 ?? "—"} - {r.score_2 ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
