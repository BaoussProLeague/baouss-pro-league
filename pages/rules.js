import { useEffect, useState } from "react";

export default function Rules() {
  const [months, setMonths] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    fetch("/api/fpl/months")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setMonths(d.months)))
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  return (
    <div className="container">
      <div className="hero">
        <h1>Set Rules</h1>
        <p>The tie-break order that applies whenever two or more managers are level for any prize, and this season's actual gameweek-to-month calendar, pulled live from FPL so it's never out of date.</p>
      </div>

      <div className="card">
        <h2>Tie-break order</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Applied across whatever window the specific prize covers - a single gameweek, a calendar month, or the full season. Mega GW is the one exception: it skips straight to bench points, since season-long totals aren't meaningful for a single-gameweek prize.
        </p>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 14 }}>
          <li>Total points (overall points) - except for Mega GW</li>
          <li>Bench points</li>
          <li>Captain points</li>
          <li>Coin toss</li>
        </ol>
      </div>

      <div className="card">
        <h2>2026/27 calendar months → gameweeks</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          A gameweek counts toward the month its deadline falls in. Pulled live from FPL's own schedule - if a fixture gets rearranged for TV, this updates with it.
        </p>
        {error && (
          <div>
            <p className="error" style={{ marginBottom: 10 }}>Couldn't load the live calendar: {error}</p>
            <button onClick={load}>Retry</button>
          </div>
        )}
        {!months && !error && <p className="muted">Loading this season's schedule…</p>}
        {months && (
          <div className="table-scroll"><table>
            <thead><tr><th>Month</th><th>Gameweeks</th></tr></thead>
            <tbody>
              {Object.entries(months).map(([m, gws]) => (
                <tr key={m}><td>{m}</td><td>{gws.join(", ")}</td></tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
