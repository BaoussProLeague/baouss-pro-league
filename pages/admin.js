import { useState, useEffect } from "react";
import Dialog from "../components/Dialog";
import { validateGw, validateEntryId, validateRequired, validatePositiveNumber, validatePhone, firstError } from "../lib/validation";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [dialog, setDialog] = useState(null); // { type, title, message }

  const [gw, setGw] = useState("");
  const [captaincyGw, setCaptaincyGw] = useState("");

  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regTeam, setRegTeam] = useState("");
  const [regAmount, setRegAmount] = useState("");
  const [regCurrency, setRegCurrency] = useState("INR");
  const [regPaidTo, setRegPaidTo] = useState("");
  const [registrations, setRegistrations] = useState([]);

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

  const [logs, setLogs] = useState([]);

  const showError = (message) => setDialog({ type: "error", title: "Fix this before continuing", message });
  const showSuccess = (message) => setDialog({ type: "success", title: "Saved", message });

  const unlock = async () => {
    setAuthError(null);
    try {
      const res = await fetch(`/api/admin/finance?password=${encodeURIComponent(password)}`);
      const d = await res.json();
      if (d.error) {
        setAuthError("Wrong password. Try again.");
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
    } catch (e) {
      setAuthError("Couldn't reach the server. Check your internet connection and try again.");
    }
  };

  const call = async (url, body) => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, ...body }),
      });
      const data = await res.json();
      if (data.error) {
        showError(data.error);
        return null;
      }
      return data;
    } catch (e) {
      showError("Couldn't reach the server. Check your internet connection and try again.");
      return null;
    }
  };

  const loadRegistrations = async () => {
    try {
      const res = await fetch(`/api/admin/registrations-list?password=${encodeURIComponent(password)}`);
      const d = await res.json();
      if (!d.error) setRegistrations(d.registrations);
    } catch (e) {
      // Silent - the registrations card itself already shows "no entries" if this stays empty.
    }
  };

  const loadLogs = async () => {
    try {
      const res = await fetch(`/api/admin/logs?password=${encodeURIComponent(password)}`);
      const d = await res.json();
      if (!d.error) setLogs(d.logs);
    } catch (e) {}
  };

  const reloadFinance = async () => {
    const res = await fetch(`/api/admin/finance?password=${encodeURIComponent(password)}`);
    const d = await res.json();
    if (!d.error) setFinance(d);
  };

  useEffect(() => {
    if (unlocked) {
      loadRegistrations();
      loadLogs();
    }
  }, [unlocked]);

  const runLms = async () => {
    const err = firstError([validateGw(gw)]);
    if (err) return showError(err);
    const result = await call("/api/admin/lms-run", { gw });
    if (result) {
      showSuccess(result.status === "manual_action_required" ? result.message : `LMS elimination recorded for GW${gw}.`);
      loadLogs();
    }
  };

  const runCaptaincy = async () => {
    const err = firstError([validateGw(captaincyGw)]);
    if (err) return showError(err);
    const result = await call("/api/admin/captaincy-run", { gw: captaincyGw });
    if (result) {
      showSuccess(`Captain accuracy recorded for ${result.recorded} managers in GW${captaincyGw}.`);
      loadLogs();
    }
  };

  const saveKnockout = async () => {
    const err = firstError([
      validateGw(koGw),
      validateEntryId(koEntry1, "Entry ID 1"),
      validateEntryId(koEntry2, "Entry ID 2"),
    ]);
    if (err) return showError(err);
    if (koEntry1 === koEntry2) return showError("Entry ID 1 and Entry ID 2 can't be the same team.");

    const result = await call("/api/admin/h2h-knockout", {
      cup: koCup, round: koRound, gw: koGw,
      entryId1: Number(koEntry1), entryId2: Number(koEntry2),
      score1: koScore1 ? Number(koScore1) : null,
      score2: koScore2 ? Number(koScore2) : null,
      winnerEntryId: koScore1 && koScore2 ? (Number(koScore1) > Number(koScore2) ? Number(koEntry1) : Number(koEntry2)) : null,
    });
    if (result) {
      showSuccess("Knockout result saved.");
      setKoGw(""); setKoEntry1(""); setKoEntry2(""); setKoScore1(""); setKoScore2("");
      loadLogs();
    }
  };

  const saveRegistration = async () => {
    const err = firstError([
      validateRequired(regName, "Manager name"),
      validatePhone(regPhone),
      validateRequired(regTeam, "FPL team name"),
      validatePositiveNumber(regAmount, "Amount"),
      validateRequired(regPaidTo, "Paid to"),
    ]);
    if (err) return showError(err);

    const result = await call("/api/admin/registration", {
      managerName: regName, phone: regPhone, fplTeamName: regTeam,
      amount: Number(regAmount), currency: regCurrency, paidTo: regPaidTo, paid: true,
    });
    if (result) {
      showSuccess(`Registration saved for ${regName} (${regTeam}).`);
      setRegName(""); setRegPhone(""); setRegTeam(""); setRegAmount(""); setRegPaidTo("");
      loadRegistrations();
      loadLogs();
    }
  };

  const saveRebuy = async () => {
    const err = firstError([validateEntryId(entryId), validateRequired(entryName, "Team name")]);
    if (err) return showError(err);
    const result = await call("/api/admin/rebuy", { entryId: Number(entryId), entryName, paid: true });
    if (result) {
      showSuccess(`Rebuy recorded for ${entryName}.`);
      setEntryId(""); setEntryName("");
      loadLogs();
    }
  };

  const savePool = async () => {
    const err = firstError([
      validatePositiveNumber(totalPlayers, "Total players"),
      validatePositiveNumber(buyinInr, "Buy-in INR"),
    ]);
    if (err) return showError(err);
    const result = await call("/api/admin/finance", {
      action: "setPool", totalPlayers: Number(totalPlayers), buyinInr: Number(buyinInr),
      buyinUsd: Number(buyinUsd) || 0, adminFeesInr: Number(adminFeesInr) || 0,
    });
    if (result) {
      showSuccess("Prize pool settings saved.");
      reloadFinance();
    }
  };

  const savePayout = async () => {
    const err = firstError([
      validateRequired(prizeKey, "Prize key"),
      validateRequired(prizeLabel, "Prize label"),
      validateRequired(winnerName, "Winner name"),
      validatePositiveNumber(amount, "Amount"),
    ]);
    if (err) return showError(err);
    const result = await call("/api/admin/finance", {
      action: "upsertPayout", prizeKey, prizeLabel, winnerName, amount: Number(amount), assignedAdmin, paid: false,
    });
    if (result) {
      showSuccess(`Payout entry saved for ${winnerName}.`);
      setPrizeKey(""); setPrizeLabel(""); setWinnerName(""); setAmount(""); setAssignedAdmin("");
      reloadFinance();
    }
  };

  const markPayoutPaid = async (p) => {
    const result = await call("/api/admin/finance", {
      action: "upsertPayout", prizeKey: p.prize_key, prizeLabel: p.prize_label,
      winnerEntryId: p.winner_entry_id, winnerName: p.winner_name,
      amount: p.amount, currency: p.currency, assignedAdmin: p.assigned_admin, paid: true,
    });
    if (result) {
      showSuccess(`Marked ${p.winner_name}'s payout as paid.`);
      reloadFinance();
    }
  };

  if (!unlocked) {
    return (
      <div className="container">
        <Dialog dialog={dialog} onClose={() => setDialog(null)} />
        <div className="card" style={{ maxWidth: 420, margin: "3rem auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>Admin</h1>
          <p className="muted">Enter the admin password to manage LMS, H2H, registrations, and finance.</p>
          <input
            type="password" placeholder="Admin password" value={password}
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
      <Dialog dialog={dialog} onClose={() => setDialog(null)} />

      <div className="hero">
        <h1>Admin</h1>
        <p>Every action below is validated before it's saved - bad input gets caught with a specific error, not silently accepted. Everything here, including finance, is behind this one password.</p>
      </div>

      <div className="card">
        <h2>Run LMS elimination</h2>
        <p className="muted">Only run after a GW locks and bonus points settle - GW must be 1-38.</p>
        <input placeholder="Gameweek number" value={gw} onChange={(e) => setGw(e.target.value)} style={{ width: 160 }} />
        {" "}
        <button onClick={runLms}>Run elimination for this GW</button>
      </div>

      <div className="card">
        <h2>Run captain accuracy check (Perfect Captaincy)</h2>
        <input placeholder="Gameweek number" value={captaincyGw} onChange={(e) => setCaptaincyGw(e.target.value)} style={{ width: 160 }} />
        {" "}
        <button onClick={runCaptaincy}>Run for this GW</button>
      </div>

      <div className="card">
        <h2>Record H2H knockout result</h2>
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
        <button onClick={saveKnockout}>Save result</button>
      </div>

      <div className="card">
        <h2>Add registration</h2>
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
        <button onClick={saveRegistration}>Save registration</button>

        <div style={{ marginTop: 18, borderTop: "0.5px solid var(--border)", paddingTop: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>All registrations ({registrations.length})</p>
          {registrations.length === 0 ? (
            <p className="muted">No registrations saved yet.</p>
          ) : (
            <table>
              <thead><tr><th>Manager</th><th>Team</th><th>Phone</th><th>Amount</th><th>Paid to</th></tr></thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id}>
                    <td>{r.manager_name}</td>
                    <td>{r.fpl_team_name}</td>
                    <td>{r.phone}</td>
                    <td>{r.currency === "USD" ? "$" : "₹"}{r.amount}</td>
                    <td>{r.paid_to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Record LMS rebuy</h2>
        <input placeholder="Entry ID" value={entryId} onChange={(e) => setEntryId(e.target.value)} style={{ width: 160 }} />
        {" "}
        <input placeholder="Team name" value={entryName} onChange={(e) => setEntryName(e.target.value)} />
        {" "}
        <button onClick={saveRebuy}>Mark ₹500 paid</button>
      </div>

      <div className="card" style={{ borderColor: "var(--border-strong)" }}>
        <h2>Finance (private)</h2>
        <p className="muted">Prize pool math, admin fees, rebuy income, payout status. Visible only on this unlocked page.</p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
          <input placeholder="Total players" value={totalPlayers} onChange={(e) => setTotalPlayers(e.target.value)} style={{ width: 110 }} />
          <input placeholder="Buy-in INR" value={buyinInr} onChange={(e) => setBuyinInr(e.target.value)} style={{ width: 110 }} />
          <input placeholder="Buy-in USD" value={buyinUsd} onChange={(e) => setBuyinUsd(e.target.value)} style={{ width: 110 }} />
          <input placeholder="Admin fees INR" value={adminFeesInr} onChange={(e) => setAdminFeesInr(e.target.value)} style={{ width: 130 }} />
          <button onClick={savePool}>Save</button>
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
          <button onClick={savePayout}>Save as unpaid</button>
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
                  <td>{!p.paid && <button onClick={() => markPayoutPaid(p)}>Mark paid</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Activity log</h2>
        <p className="muted">Persistent record of every admin action - survives a refresh, unlike a browser-only log.</p>
        {logs.length === 0 ? (
          <p className="muted">No activity recorded yet.</p>
        ) : (
          <table>
            <thead><tr><th>When</th><th>Action</th><th>Summary</th><th>Result</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.action}</td>
                  <td>{l.summary}</td>
                  <td>{l.success ? <span className="pill alive">OK</span> : <span className="pill out">Failed</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
