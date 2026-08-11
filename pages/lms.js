import { useEffect, useState } from "react";

export default function Lms() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/lms/status")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="container">
      <div className="card">
        <h1>Last Manager Standing</h1>
        <p className="muted">
          Starts GW2. Lowest scorer each week is eliminated. Eliminated on/before GW21 can rebuy for ₹500.
          Break GW22-24. LMS resumes GW25 with rebuys + GW21 survivors.
        </p>
      </div>

      {error && <div className="card error">Couldn't load LMS status: {error}</div>}

      {data && (
        <>
          <div className="card">
            <h2>Still Alive ({data.stillAliveCount})</h2>
            <table>
              <thead><tr><th>Team</th><th>Status</th></tr></thead>
              <tbody>
                {data.stillAlive.map((e) => (
                  <tr key={e.entry}><td>{e.entryName}</td><td><span className="pill alive">Alive</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Eliminated</h2>
            <table>
              <thead><tr><th>GW Out</th><th>Team</th><th>Score</th><th>Rebuy Eligible</th><th>Rebought?</th></tr></thead>
              <tbody>
                {data.eliminations.map((e) => {
                  const rebuy = data.rebuys.find((r) => r.entry_id === e.entry_id);
                  const eligible = e.gw_eliminated <= 21;
                  return (
                    <tr key={e.entry_id}>
                      <td>{e.gw_eliminated}</td>
                      <td>{e.entry_name}</td>
                      <td>{e.gw_score}</td>
                      <td>{eligible ? "Yes" : "No"}</td>
                      <td>{rebuy && rebuy.paid ? "Yes (₹500 paid)" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
