import { useEffect, useState } from "react";

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/fpl/classic")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="container">
      <div className="card">
        <h1>Classic League</h1>
        <p className="muted">
          Highest overall score (incl. hits) at end of season wins. Top 8 places paid. Ties resolved by Set Rules.
        </p>
      </div>

      {error && <div className="card error">Couldn't load standings: {error}</div>}

      {data && (
        <div className="card">
          <h2>{data.league.name}</h2>
          <table>
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
          </table>
        </div>
      )}

      {!data && !error && <div className="card muted">Loading standings…</div>}
    </div>
  );
}
