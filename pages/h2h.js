import { useState } from "react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import TruncateText from "../components/TruncateText";

const ROUND_LABELS = { r16: "Round of 16", qf: "Quarter-Final", sf: "Semi-Final", final: "Final" };

export default function H2H() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [knockout, setKnockout] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/fpl/h2h")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    fetch("/api/h2h/knockout")
      .then((r) => r.json())
      .then((d) => !d.error && setKnockout(d))
      .catch(() => {});
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

      {data && (
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
                    <td>{row.rank}</td><td><TruncateText text={row.entryName} maxWidth={160} href={`/team/${row.entry}`} /></td>
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
