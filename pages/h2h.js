import { useEffect, useState } from "react";

const ROUND_LABELS = { r16: "Round of 16", qf: "Quarter-Final", sf: "Semi-Final", final: "Final" };

export default function H2H() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [knockout, setKnockout] = useState(null);

  useEffect(() => {
    fetch("/api/fpl/h2h")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));

    fetch("/api/h2h/knockout")
      .then((r) => r.json())
      .then((d) => !d.error && setKnockout(d))
      .catch(() => {});
  }, []);

  return (
    <div className="container">
      <div className="hero">
        <h1>Head-to-Head League</h1>
        <p>Single H2H league through GW30, top 32 split into Gold (1-16) and Silver (17-32) cups. Single-leg knockouts: R16 (GW32) → QF (GW34) → SF (GW36) → Final (GW38).</p>
      </div>

      {error && <div className="card error">Couldn't load H2H data: {error}</div>}

      {data && (
        <>
          <div className="grid">
            <div className="card">
              <h2>Gold Cup Qualifiers (Rank 1-16)</h2>
              <table>
                <thead><tr><th>Rank</th><th>Team</th></tr></thead>
                <tbody>
                  {data.cupQualification.gold.map((e) => (
                    <tr key={e.entry}><td>{e.rank}</td><td>{e.entryName}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h2>Silver Cup Qualifiers (Rank 17-32)</h2>
              <table>
                <thead><tr><th>Rank</th><th>Team</th></tr></thead>
                <tbody>
                  {data.cupQualification.silver.map((e) => (
                    <tr key={e.entry}><td>{e.rank}</td><td>{e.entryName}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>Full League Table</h2>
            <table>
              <thead>
                <tr><th>Rank</th><th>Team</th><th>Pld</th><th>W</th><th>D</th><th>L</th><th>Pts</th></tr>
              </thead>
              <tbody>
                {data.standings.map((row) => (
                  <tr key={row.entry}>
                    <td>{row.rank}</td><td>{row.entryName}</td><td>{row.played}</td>
                    <td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td><td><strong>{row.points}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {knockout && (knockout.gold.length > 0 || knockout.silver.length > 0) ? (
            <div className="grid">
              {["gold", "silver"].map((cup) => (
                <div className="card" key={cup}>
                  <h2>{cup === "gold" ? "Gold Cup" : "Silver Cup"} Bracket</h2>
                  {knockout[cup].length === 0 ? (
                    <p className="muted">No rounds recorded yet.</p>
                  ) : (
                    <table>
                      <thead><tr><th>Round</th><th>GW</th><th>Fixture</th><th>Score</th></tr></thead>
                      <tbody>
                        {knockout[cup].map((r) => (
                          <tr key={r.id}>
                            <td>{ROUND_LABELS[r.round] || r.round}</td>
                            <td>{r.gw}</td>
                            <td>{r.entry_id_1} vs {r.entry_id_2}</td>
                            <td>{r.score_1 ?? "—"} - {r.score_2 ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card muted">
              No knockout rounds recorded yet. Admin enters each round's result once it's played -
              FPL's H2H standings object only knows the group phase, not your custom Gold/Silver bracket.
            </div>
          )}
        </>
      )}
    </div>
  );
}
