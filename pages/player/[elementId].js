import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const TYPE_LABELS = { 1: "Goalkeeper", 2: "Defender", 3: "Midfielder", 4: "Forward" };
const STATUS_LABELS = { a: null, i: "Injured", d: "Doubtful", s: "Suspended", u: "Unavailable" };
const DIFFICULTY_COLORS = { 1: "var(--success)", 2: "var(--success)", 3: "var(--accent-bright)", 4: "var(--danger)", 5: "var(--danger)" };

function Crest({ code, size = 22 }) {
  const [failed, setFailed] = useState(false);
  if (!code || failed) return null;
  return (
    <img src={`https://resources.premierleague.com/premierleague/badges/70/t${code}.png`} alt="" width={size} height={size}
      style={{ objectFit: "contain" }} onError={() => setFailed(true)} />
  );
}

export default function PlayerDetail() {
  const router = useRouter();
  const { elementId } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!elementId) return;
    fetch(`/api/fpl/player/${elementId}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));
  }, [elementId]);

  if (error) {
    return <div className="container"><div className="card error"><p>{error}</p></div></div>;
  }
  if (!data) {
    return <div className="container"><div className="card muted">Loading player…</div></div>;
  }

  const statusNote = STATUS_LABELS[data.status];

  return (
    <div className="container">
      <div className="hero">
        <p style={{ marginBottom: 8 }}><Link href="/" style={{ color: "var(--muted)", fontSize: 13 }}>← Back to standings</Link></p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {data.photoCode && (
            <img
              src={`https://resources.premierleague.com/premierleague26/photos/players/110x140/${data.photoCode}.png`}
              alt="" width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }}
            />
          )}
          <div>
            <h1 style={{ marginBottom: 2 }}>{data.fullName}</h1>
            <p style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Crest code={data.teamCode} /> {data.teamName} · {TYPE_LABELS[data.elementType]}
            </p>
          </div>
        </div>
        {statusNote && (
          <p style={{ marginTop: 8 }}><span className="pill out">{statusNote}</span>{data.news && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{data.news}</span>}</p>
        )}
      </div>

      <div className="grid">
        <div className="stat"><div className="label">Total points</div><div className="value">{data.totalPoints}</div></div>
        <div className="stat"><div className="label">Price</div><div className="value">£{data.nowCost.toFixed(1)}m</div></div>
        <div className="stat"><div className="label">Form</div><div className="value">{data.form}</div></div>
        <div className="stat"><div className="label">Selected by</div><div className="value">{data.selectedByPercent}%</div></div>
      </div>

      <div className="card">
        <h2>Season stats</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
          <div className="stat"><div className="label">Minutes</div><div className="value" style={{ fontSize: 18 }}>{data.minutes}</div></div>
          <div className="stat"><div className="label">Goals</div><div className="value" style={{ fontSize: 18 }}>{data.goalsScored}</div></div>
          <div className="stat"><div className="label">Assists</div><div className="value" style={{ fontSize: 18 }}>{data.assists}</div></div>
          <div className="stat"><div className="label">Clean sheets</div><div className="value" style={{ fontSize: 18 }}>{data.cleanSheets}</div></div>
          <div className="stat"><div className="label">Bonus</div><div className="value" style={{ fontSize: 18 }}>{data.bonus}</div></div>
          <div className="stat"><div className="label">BPS</div><div className="value" style={{ fontSize: 18 }}>{data.bps}</div></div>
          <div className="stat"><div className="label">Yellow cards</div><div className="value" style={{ fontSize: 18 }}>{data.yellowCards}</div></div>
          <div className="stat"><div className="label">Red cards</div><div className="value" style={{ fontSize: 18 }}>{data.redCards}</div></div>
        </div>
      </div>

      {data.upcomingFixtures.length > 0 && (
        <div className="card">
          <h2>Upcoming fixtures</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {data.upcomingFixtures.map((f, i) => (
              <div key={i} style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "8px 14px", fontSize: 13, textAlign: "center" }}>
                <div className="muted" style={{ fontSize: 11 }}>GW{f.gw}</div>
                <div style={{ fontWeight: 600 }}>{f.isHome ? "vs" : "@"} {f.opponent}</div>
                <div style={{ color: DIFFICULTY_COLORS[f.difficulty] || "var(--muted)", fontSize: 11, marginTop: 2 }}>FDR {f.difficulty}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Gameweek by gameweek</h2>
        {data.history.length === 0 ? (
          <p className="muted">No gameweeks played yet this season.</p>
        ) : (
          <div className="table-scroll"><table>
            <thead><tr><th>GW</th><th>Opponent</th><th>Min</th><th>G</th><th>A</th><th>Pts</th></tr></thead>
            <tbody>
              {data.history.slice().reverse().map((h) => (
                <tr key={h.gw}>
                  <td>{h.gw}</td>
                  <td>{h.wasHome ? "vs" : "@"} {h.opponent}</td>
                  <td>{h.minutes}</td>
                  <td>{h.goals}</td>
                  <td>{h.assists}</td>
                  <td><strong>{h.points}</strong></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
