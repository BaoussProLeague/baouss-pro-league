import { useState } from "react";

// Single gate: nothing on this page renders until the right password is
// entered once. After that, every admin action (LMS, captaincy, H2H
// knockout, registrations, AND finance) is available in this one view -
// no second password, no separate /admin/finance route.
export default function Admin() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [gw, setGw] = useState("");
  const [captaincyGw, setCaptaincyGw] = useState("");
  const [log, setLog] = useState([]);

  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regTeam, setRegTeam] = useState("");
  const [regAmount, setRegAmount] = useState("");
  const [regCurrency, setRegCurrency] = useState("INR");
  const [regPaidTo, setRegPaidTo] = useState("");

  const [entryId, setEntryId] = useState("");
  const [entryName, setEntryName] = useState("");

  const [koCup, setKoCup] = useState("gold");
  const [koRound, setKoRound] = useState("r16");
  const [koGw, setKoGw] = useState("");
  const [koEntry1, setKoEntry1] = useState("");
  const [koEntry2, setKoEntry2] = useState("");
  const [koScore1, setKoScore1] = useState("");
  const [koScore2, setKoScore2] = useState("");

  const [finance, setFinance] = useState(null);
  const [totalPlayers, setTotalPlayers] = useState("");
  const [buyinInr, setBuyinInr] = useState("");
  const [buyinUsd, setBuyinUsd] = useState("");
  const [adminFeesInr, setAdminFeesInr] = useState("");
  const [prizeKey, setPrizeKey] = useState("");
  const [prizeLabel, setPrizeLabel] = useState("");
  const [winnerName, setWinnerName] = useState("");
  const [amount, setAmount] = useState("");
  const [assignedAdmin, setAssignedAdmin] = useState("");

  const unlock = async () => {
    setAuthError(null);
    const res = await fetch(`/api/admin/finance?password=${encodeURIComponent(password)}`);
    const d = await res.json();
    if (d.error) {
      setAuthError("Wrong password.");
      return;
    }
    setFinance(d);
    if (d.pool) {
      setTotalPlayers(d.pool.total_players || "");
      setBuyinInr(d.pool.buyin_inr || "");
      setBuyinUsd(d.pool.buyin_usd || "");
      setAdminFeesInr(d.pool.admin_fees_inr || "");
    }
    setUnlocked(true);
  };

  const call = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, ...body }),
    });
    const data = await res.json();
    setLog((l) => [{ time: new Date().toLocaleTimeString(), url, data }, ...l]);
    return data;
  };

  const reloadFinance = async () => {
    const res = await fetch(`/api/admin/finance?password=${encodeURIComponent(password)}`);
    const d = await res.json();
    if (!d.error) setFinance(d);
  };

  if (!unlocked) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: 420, margin: "3rem auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>Admin</h1>
          <p className="muted">Enter the admin password to manage LMS, H2H, registrations, and finance.</p>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <button onClick={unlock} style={{ width: "100%" }}>Unlock</button>
          {authError && <p className="error" style={{ marginTop: 10 }}>{authError}</p>}
        </div>
      </div>
    );
  }

  const grossPool = (Number(totalPlayers) || 0) * (Number(buyinInr) || 0);
  const netPool = finance ? grossPool - (Number(adminFeesInr) || 0) + finance.rebuyIncome : 0;

  return (
    <div className="container">
      <div className="card">
        <h1 style={{ fontSize: 20 }}>Admin</h1>
        <p className="muted">Unlocked. Every action below is admin-only, including the finance section at the bottom.</p>
      </div>

      <div className="card">
        <h2>Run LMS Elimination</h2>
        <p className="muted">Only run after a GW locks and bonus points settle.</p>
        <input placeholder="Gameweek number" value={gw} onChange={(e) => setGw(e.target.value)} style={{ width: 160 }} />
        {" "}
        <button onClick={() => call("/api/admin/lms-run", { gw })}>Run elimination for this GW</button>
      </div>

      <div className="card">
        <h2>Run Captain Accuracy Check (Perfect Captaincy)</h2>
        <input placeholder="Gameweek number" value={captaincyGw} onChange={(e) => setCaptaincyGw(e.target.value)} style={{ width: 160 }} />
        {" "}
        <button onClick={() => call("/api/admin/captaincy-run", { gw: captaincyGw })}>Run for this GW</button>
      </div>

      <div className="card">
        <h2>Record H2H Knockout Result</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <select value={koCup} onChange={(e) => setKoCup(e.target.value)}>
            <option value="gold">Gold Cup</option>
            <option value="silver">Silver Cup</option>
          </select>
          <select value={koRound} onChange={(e) => setKoRound(e.target.value)}>
            <option value="r16">Round of 16</option>
            <option value="qf">Quarter-Final</option>
            <option value="sf">Semi-Final</option>
            <option value="final">Final</option>
          </select>
          <input placeholder="GW" value={koGw} onChange={(e) => setKoGw(e.target.value)} style={{ width: 80 }} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input placeholder="Entry ID 1" value={koEntry1} onChange={(e) => setKoEntry1(e.target.value)} style={{ width: 120 }} />
          <input placeholder="Score 1" value={koScore1} onChange={(e) => setKoScore1(e.target.value)} style={{ width: 90 }} />
          <input placeholder="Entry ID 2" value={koEntry2} onChange={(e) => setKoEntry2(e.target.value)} style={{ width: 120 }} />
          <input placeholder="Score 2" value={koScore2} onChange={(e) => setKoScore2(e.target.value)} style={{ width: 90 }} />
        </div>
        <button
          onClick={() =>
            call("/api/admin/h2h-knockout", {
              cup: koCup, round: koRound, gw: koGw,
              entryId1: Number(koEntry1), entryId2: Number(koEntry2),
              score1: koScore1 ? Number(koScore1) : null,
              score2: koScore2 ? Number(koScore2) : null,
              winnerEntryId: koScore1 && koScore2 ? (Number(koScore1) > Number(koScore2) ? Number(koEntry1) : Number(koEntry2)) : null,
            })
          }
        >
          Save result
        </button>
      </div>

      <div className="card">
        <h2>Add Registration</h2>
        <p className="muted">Contains phone numbers - visible only here, behind this password.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input placeholder="Manager name" value={regName} onChange={(e) => setRegName(e.target.value)} />
          <input placeholder="Phone (with country code)" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} />
          <input placeholder="FPL team name" value={regTeam} onChange={(e) => setRegTeam(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input placeholder="Amount" value={regAmount} onChange={(e) => setRegAmount(e.target.value)} style={{ width: 100 }} />
          <select value={regCurrency} onChange={(e) => setRegCurrency(e.target.value)}>
            <option value="INR">INR</option>
            <option value="USD">USD</option>
          </select>
          <input placeholder="Paid to (admin name)" value={regPaidTo} onChange={(e) => setRegPaidTo(e.target.value)} />
        </div>
        <button
          onClick={() =>
            call("/api/admin/registration", {
              managerName: regName, phone: regPhone, fplTeamName: regTeam,
              amount: regAmount ? Number(regAmount) : null, currency: regCurrency,
              paidTo: regPaidTo, paid: true,
            })
          }
        >
          Save registration (marks as paid)
        </button>
      </div>

      <div className="card">
        <h2>Record LMS Rebuy</h2>
        <input placeholder="Entry ID" value={entryId} onChange={(e) => setEntryId(e.target.value)} style={{ width: 160 }} />
        {" "}
        <input placeholder="Team name" value={entryName} onChange={(e) => setEntryName(e.target.value)} />
        {" "}
        <button onClick={() => call("/api/admin/rebuy", { entryId: Number(entryId), entryName, paid: true })}>
          Mark ₹500 paid
        </button>
      </div>

      <div className="card" style={{ borderColor: "var(--border-strong)" }}>
        <h2>Finance (private)</h2>
        <p className="muted">Prize pool math, admin fees, rebuy income, payout status. Visible only on this unlocked page.</p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
          <input placeholder="Total players" value={totalPlayers} onChange={(e) => setTotalPlayers(e.target.value)} style={{ width: 110 }} />
          <input placeholder="Buy-in INR" value={buyinInr} onChange={(e) => setBuyinInr(e.target.value)} style={{ width: 110 }} />
          <input placeholder="Buy-in USD" value={buyinUsd} onChange={(e) => setBuyinUsd(e.target.value)} style={{ width: 110 }} />
          <input placeholder="Admin fees INR" value={adminFeesInr} onChange={(e) => setAdminFeesInr(e.target.value)} style={{ width: 130 }} />
          <button
            onClick={async () => {
              await call("/api/admin/finance", {
                action: "setPool",
                totalPlayers: Number(totalPlayers), buyinInr: Number(buyinInr),
                buyinUsd: Number(buyinUsd), adminFeesInr: Number(adminFeesInr),
              });
              reloadFinance();
            }}
          >
            Save
          </button>
        </div>

        {finance && (
          <div style={{ fontSize: 14, lineHeight: 1.9, marginBottom: 16 }}>
            <p>Gross pool: <strong>₹{grossPool.toLocaleString()}</strong></p>
            <p>Rebuy income collected: <strong>₹{finance.rebuyIncome.toLocaleString()}</strong></p>
            <p>Net pool after fees + rebuys: <strong>₹{netPool.toLocaleString()}</strong></p>
            <p>Already paid out: <strong>₹{finance.totalPaidOut.toLocaleString()}</strong></p>
            <p>Still owed: <strong>₹{finance.totalOwed.toLocaleString()}</strong></p>
          </div>
        )}

        <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 14, marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Add / update a payout</p>
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
            onClick={async () => {
              await call("/api/admin/finance", {
                action: "upsertPayout", prizeKey, prizeLabel, winnerName,
                amount: Number(amount), assignedAdmin, paid: false,
              });
              reloadFinance();
            }}
          >
            Save as unpaid
          </button>
        </div>

        {finance && finance.payouts.length > 0 && (
          <table>
            <thead><tr><th>Prize</th><th>Winner</th><th>Amount</th><th>Admin</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {finance.payouts.map((p) => (
                <tr key={p.id}>
                  <td>{p.prize_label}</td>
                  <td>{p.winner_name}</td>
                  <td>₹{Number(p.amount).toLocaleString()}</td>
                  <td>{p.assigned_admin || "—"}</td>
                  <td>{p.paid ? <span className="pill alive">Paid</span> : <span className="pill out">Owed</span>}</td>
                  <td>
                    {!p.paid && (
                      <button
                        onClick={async () => {
                          await call("/api/admin/finance", {
                            action: "upsertPayout", prizeKey: p.prize_key, prizeLabel: p.prize_label,
                            winnerEntryId: p.winner_entry_id, winnerName: p.winner_name,
                            amount: p.amount, currency: p.currency, assignedAdmin: p.assigned_admin, paid: true,
                          });
                          reloadFinance();
                        }}
                      >
                        Mark paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Activity Log</h2>
        {log.length === 0 && <p className="muted">Nothing yet.</p>}
        {log.map((l, i) => (
          <pre key={i} style={{ fontSize: 12, whiteSpace: "pre-wrap", borderBottom: "1px solid var(--border)", padding: "8px 0" }}>
            {l.time} — {l.url}{"\n"}{JSON.stringify(l.data, null, 2)}
          </pre>
        ))}
      </div>
    </div>
  );
}
