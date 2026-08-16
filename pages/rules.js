export default function Rules() {
  const months = [
    ["August", "1, 2, 3"],
    ["September", "4, 5, 6"],
    ["October", "7, 8, 9"],
    ["November", "10, 11, 12, 13"],
    ["December", "14, 15, 16, 17, 18, 19"],
    ["January", "20, 21, 22, 23, 24"],
    ["February", "25, 26, 27, 28"],
    ["March", "29, 30, 31"],
    ["April", "32, 33, 34"],
    ["May", "35, 36, 37, 38"],
  ];

  return (
    <div className="container">
      <div className="hero">
        <h1>Set Rules</h1>
        <p>The tie-break order that applies whenever two or more managers are level for any prize, and the calendar used to assign gameweeks to months.</p>
      </div>

      <div className="card">
        <h2>Tie-break order</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Applied over whatever period the specific prize covers (a single GW, a month, or the full season). Mega GW is the one exception - it skips straight to bench points since total season points aren't relevant to a single-GW prize.
        </p>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 14 }}>
          <li>Total points (overall points) - except for Mega GW calculations</li>
          <li>Bench points</li>
          <li>Captain points</li>
          <li>Coin toss</li>
        </ol>
      </div>

      <div className="card">
        <h2>FPL calendar months → gameweeks</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          A gameweek counts as part of the month it begins in. Used for Manager of the Month and monthly Rank Jump.
        </p>
        <table>
          <thead><tr><th>Month</th><th>Gameweeks</th></tr></thead>
          <tbody>
            {months.map(([m, gws]) => (
              <tr key={m}><td>{m}</td><td>{gws}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
