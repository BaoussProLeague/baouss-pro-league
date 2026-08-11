import { useState } from "react";

// This page is intentionally NOT in the main nav (components/Nav.js) and
// asks for its own password rather than reading one from anywhere shared -
// per your call, all prize-pool math, admin fees, rebuy income, and
// payout status stays admin-only and never touches a public page.
export default function Finance() {
  const [password, setPassword] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const [totalPlayers, setTotalPlayers] = useState("");
  const [buyinInr, setBuyinInr] = useState("");
  const [buyinUsd, setBuyinUsd] = useState("");
  const [adminFeesInr, setAdminFeesInr] = useState("");

  const [prizeKey, setPrizeKey] = useState("");
  const [prizeLabel, setPrizeLabel] = useState("");
  const [winnerName, setWinnerName] = useState("");
  const [amount, setAmount] = useState("");
  const [assignedAdmin, setAssignedAdmin] = useState("");

  const load = async () => {
    setError(null);
    const res = await fetch(`/api/admin/finance?password=${encodeURIComponent(password)}`);
    const d = await res.json();
    if (d.error) setError(d.error);
    else {
      setData(d);
      if (d.pool) {
        setTotalPlayers(d.pool.total_players || "");
        setBuyinInr(d.pool.buyin_inr || "");
        setBuyinUsd(d.pool.buyin_usd || "");
        setAdminFeesInr(d.pool.admin_fees_inr || "");
      }
    }
  };

  const post = async (body) => {
    await fetch("/api/admin/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, ...body }),
    });
    load();
  };

  const grossPool = (Number(totalPlayers) || 0) * (Number(buyinInr) || 0);
  const netPool = grossPool - (Number(adminFeesInr) || 0) + (data ? data.rebuyIncome : 0);

  return (
    <div className="container">
      <div className="card">
        <h1>Finance (Private)</h1>
        <p className="muted">Not linked from the main nav. Prize pool math, admin fees, and payout status — visible to admins only.</p>
        <input type="password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {" "}
        <button onClick={load}>Load</button>
        {error && <p className="error">{error}</p>}
      </div>

      {data && (
        <>
          <div className="card">
            <h2>Prize Pool</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <input placeholder="Total players" value={totalPlayers} onChange={(e) => setTotalPlayers(e.target.value)} style={{ width: 110 }} />
              <input placeholder="Buy-in INR" value={buyinInr} onChange={(e) => setBuyinInr(e.target.value)} style={{ width: 110 }} />
              <input placeholder="Buy-in USD" value={buyinUsd} onChange={(e) => setBuyinUsd(e.target.value)} style={{ width: 110 }} />
              <input placeholder="Admin fees INR" value={adminFeesInr} onChange={(e) => setAdminFeesInr(e.target.value)} style={{ width: 130 }} />
              <button
                onClick={() =>
                  post({
                    action: "setPool",
                    totalPlayers: Number(totalPlayers),
                    buyinInr: Number(buyinInr),
                    buyinUsd: Number(buyinUsd),
                    adminFeesInr: Number(adminFeesInr),
                  })
                }
              >
                Save
              </button>
            </div>
            <p>Gross pool (players × INR buy-in): <strong>₹{grossPool.toLocaleString()}</strong></p>
            <p>Rebuy income collected: <strong>₹{data.rebuyIncome.toLocaleString()}</strong></p>
            <p>Net pool after admin fees + rebuy income: <strong>₹{netPool.toLocaleString()}</strong></p>
            <p>Total already paid out: <strong>₹{data.totalPaidOut.toLocaleString()}</strong></p>
            <p>Total still owed to winners: <strong>₹{data.totalOwed.toLocaleString()}</strong></p>
          </div>

          <div className="card">
            <h2>Add / Update a Payout</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <input placeholder="Prize key e.g. classic_rank_1" value={prizeKey} onChange={(e) => setPrizeKey(e.target.value)} />
              <input placeholder="Label e.g. Classic League Rank 1" value={prizeLabel} onChange={(e) => setPrizeLabel(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <input placeholder="Winner name" value={winnerName} onChange={(e) => setWinnerName(e.target.value)} />
              <input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 100 }} />
              <input placeholder="Assigned admin" value={assignedAdmin} onChange={(e) => setAssignedAdmin(e.target.value)} />
            </div>
            <button
              onClick={() =>
                post({
                  action: "upsertPayout",
                  prizeKey,
                  prizeLabel,
                  winnerName,
                  amount: Number(amount),
                  assignedAdmin,
                  paid: false,
                })
              }
            >
              Save as unpaid
            </button>
          </div>

          <div className="card">
            <h2>All Payouts</h2>
            <table>
              <thead><tr><th>Prize</th><th>Winner</th><th>Amount</th><th>Assigned to</th><th>Paid?</th><th></th></tr></thead>
              <tbody>
                {data.payouts.map((p) => (
                  <tr key={p.id}>
                    <td>{p.prize_label}</td>
                    <td>{p.winner_name}</td>
                    <td>₹{Number(p.amount).toLocaleString()}</td>
                    <td>{p.assigned_admin || "—"}</td>
                    <td>{p.paid ? <span className="pill alive">Paid</span> : <span className="pill out">Owed</span>}</td>
                    <td>
                      {!p.paid && (
                        <button
                          onClick={() =>
                            post({
                              action: "upsertPayout",
                              prizeKey: p.prize_key,
                              prizeLabel: p.prize_label,
                              winnerEntryId: p.winner_entry_id,
                              winnerName: p.winner_name,
                              amount: p.amount,
                              currency: p.currency,
                              assignedAdmin: p.assigned_admin,
                              paid: true,
                            })
                          }
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
