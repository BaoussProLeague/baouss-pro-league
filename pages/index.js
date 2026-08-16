import { useEffect, useState } from "react";
import TeamCrests from "../components/TeamCrests";

export default function Home() {
  const [data, setData] = useState(null);
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/fpl/classic")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    fetch("/api/fpl/bootstrap")
      .then((r) => r.json())
      .then((d) => !d.error && setTeams(d.teams))
      .catch(() => {});
  };

  useEffect(load, []);

  return (
    <div className="container">
      <div className="hero">
        <h1>Classic League</h1>
        <p>Season-long standings, updated live from the official FPL API. Highest overall score at the end of the season wins - top 8 places are paid, ties are resolved using Set Rules.</p>
      </div>

      <TeamCrests teams={teams} />

      {error && (
        <div className="card error">
          <p style={{ marginBottom: 10 }}>Couldn't load standings: {error}</p>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {loading && !error && <div className="card muted">Loading standings…</div>}

      {data && !loading && (
        <div className="card">
          <h2>{data.league.name}</h2>
          {data.standings.length === 0 ? (
            <p className="muted">No entries found for this league yet.</p>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}
