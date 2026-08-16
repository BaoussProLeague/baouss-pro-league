import { useEffect, useState } from "react";

const PRIZES = [
  { key: "teamValue", label: "Team Value", col: "value", fmt: (v) => `£${v.toFixed(1)}m` },
  { key: "benchPoints", label: "Bench Points", col: "benchPoints", fmt: (v) => v },
  { key: "first999", label: "First to 999", col: "gwReached", fmt: (v) => `GW${v}` },
  { key: "first1499", label: "First to 1499", col: "gwReached", fmt: (v) => `GW${v}` },
];

const CHIP_KEYS = ["wildcard", "freehit", "3xc", "bboost"];

export default function Prizes() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [captaincy, setCaptaincy] = useState(null);

  useEffect(() => {
    fetch("/api/prizes/summary")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));

    fetch("/api/prizes/captaincy")
      .then((r) => r.json())
      .then((d) => !d.error && setCaptaincy(d.leaderboard))
      .catch(() => {});
  }, []);

  return (
    <div className="container">
      <div className="hero">
        <h1>Side Prizes</h1>
        <p>Auto-calculated from FPL data. Mega GW, Wildcard Vision, and Def+GK still need building out (see README) - everything below is live.</p>
      </div>

      {error && <div className="card error">Couldn't load prize data: {error}</div>}
      {!data && !error && <div className="card muted">Crunching numbers…</div>}

      {data && (
        <div className="grid">
          {PRIZES.map((p) => (
            <div className="card" key={p.key}>
              <h2>{p.label}</h2>
              {data[p.key] && data[p.key].length > 0 ? (
                <table>
                  <tbody>
                    {data[p.key].slice(0, 5).map((row, i) => (
                      <tr key={row.entry}>
                        <td>{i + 1}. {row.entryName}</td>
                        <td style={{ textAlign: "right" }}>{p.fmt(row[p.col])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">Not enough data yet this season.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {data && data.chips && (
        <>
          <div className="card">
            <h1 style={{ fontSize: 18 }}>Chip Prizes</h1>
            <p className="muted">Best of your two activations this season (one set per half, per the 2026/27 rules).</p>
          </div>
          <div className="grid">
            {CHIP_KEYS.map((k) => (
              <div className="card" key={k}>
                <h2>{data.chips[k].label}</h2>
                {data.chips[k].leaderboard.length > 0 ? (
                  <table>
                    <tbody>
                      {data.chips[k].leaderboard.slice(0, 5).map((row, i) => (
                        <tr key={row.entry}>
                          <td>{i + 1}. {row.entryName}</td>
                          <td style={{ textAlign: "right" }}>{row.score} pts (GW{row.gw})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted">No activations recorded yet.</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card">
        <h2>Perfect Captaincy</h2>
        <p className="muted">Most gameweeks where your captain was actually your squad's top scorer. Updated GW-by-GW by admins after each round locks.</p>
        {captaincy && captaincy.length > 0 ? (
          <table>
            <thead><tr><th>Manager</th><th>Perfect calls</th><th>GWs tracked</th></tr></thead>
            <tbody>
              {captaincy.slice(0, 10).map((row, i) => (
                <tr key={row.entry}>
                  <td>{i + 1}. {row.entryName}</td>
                  <td>{row.perfectCalls}</td>
                  <td>{row.gwsTracked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Not tracked yet this season.</p>
        )}
      </div>
    </div>
  );
}
