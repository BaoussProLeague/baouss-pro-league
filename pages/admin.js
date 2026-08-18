import { useState, useEffect } from "react";
import Dialog from "../components/Dialog";
import { validateGw, validateRequired, validatePositiveNumber, validatePhone, firstError } from "../lib/validation";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [classicEntries, setClassicEntries] = useState([]);
  const [h2hQualifiers, setH2hQualifiers] = useState({ gold: [], silver: [] });

  const [gw, setGw] = useState("");
  const [captaincyGw, setCaptaincyGw] = useState("");
  const [defgkGw, setDefgkGw] = useState("");

  const [regId, setRegId] = useState(null); // non-null while editing
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regTeam, setRegTeam] = useState("");
  const [regAmount, setRegAmount] = useState("");
  const [regCurrency, setRegCurrency] = useState("INR");
  const [regPaidTo, setRegPaidTo] = useState("");
  const [registrations, setRegistrations] = useState([]);

  const [rebuyEntry, setRebuyEntry] = useState("");
  const [rebuys, setRebuys] = useState([]);

  const [koId, setKoId] = useState(null);
  const [koCup, setKoCup] = useState("gold");
  const [koRound, setKoRound] = useState("r16");
  const [koGw, setKoGw] = useState("");
  const [koEntry1, setKoEntry1] = useState("");
  const [koEntry2, setKoEntry2] = useState("");
  const [koScore1, setKoScore1] = useState("");
  const [koScore2, setKoScore2] = useState("");
  const [knockouts, setKnockouts] = useState([]);

  const [megaGwGw, setMegaGwGw] = useState("");
  const [megaGwLabel, setMegaGwLabel] = useState("");
  const [megaGwPrize, setMegaGwPrize] = useState("");
  const [megaGws, setMegaGws] = useState([]);

  const [finance, setFinance] = useState(null);
  const [totalPlayers, setTotalPlayers] = useState("");
  const [buyinInr, setBuyinInr] = useState("");
  const [buyinUsd, setBuyinUsd] = useState("");
  const [adminFeesInr, setAdminFeesInr] = useState("");
  const [editingPayoutKey, setEditingPayoutKey] = useState(null);
  const [editingPayoutPaid, setEditingPayoutPaid] = useState(false);
  const [prizeKey, setPrizeKey] = useState("");
  const [prizeLabel, setPrizeLabel] = useState("");
  const [winnerName, setWinnerName] = useState("");
  const [amount, setAmount] = useState("");
  const [assignedAdmin, setAssignedAdmin] = useState("");

  const [logs, setLogs] = useState([]);
  const [showFullLog, setShowFullLog] = useState(false);

  const showError = (message) => setDialog({ type: "error", title: "Fix this before continuing", message });
  const showSuccess = (message) => setDialog({ type: "success", title: "Saved", message });

  const entryLabel = (id) => {
    const inClassic = classicEntries.find((c) => c.entry === id);
    if (inClassic) return `${inClassic.managerName} (${inClassic.entryName})`;
    const inQualifiers = [...h2hQualifiers.gold, ...h2hQualifiers.silver].find((c) => c.entry === id);
    if (inQualifiers) return inQualifiers.entryName;
    return `Entry ${id}`;
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

  const loadClassicEntries = async () => {
    try {
      const res = await fetch("/api/fpl/classic");
      const d = await res.json();
      if (!d.error) {
        setClassicEntries(d.standings.map((s) => ({ entry: s.entry, entryName: s.entryName, managerName: s.managerName })));
      }
    } catch (e) {}
  };

  const loadH2hQualifiers = async () => {
    try {
      const res = await fetch("/api/fpl/h2h");
      const d = await res.json();
      if (!d.error) setH2hQualifiers(d.cupQualification);
    } catch (e) {}
  };

  const loadRegistrations = async () => {
    try {
      const res = await fetch(`/api/admin/registrations-list?password=${encodeURIComponent(password)}`);
      const d = await res.json();
      if (!d.error) setRegistrations(d.registrations);
    } catch (e) {}
  };

  const loadRebuys = async () => {
    try {
      const res = await fetch("/api/lms/status");
      const d = await res.json();
      if (!d.error) setRebuys(d.rebuys || []);
    } catch (e) {}
  };

  const loadKnockouts = async () => {
    try {
      const res = await fetch("/api/h2h/knockout");
      const d = await res.json();
      if (!d.error) setKnockouts([...(d.gold || []), ...(d.silver || [])]);
    } catch (e) {}
  };

  const loadMegaGws = async () => {
    try {
      const res = await fetch("/api/prizes/mega-gw");
      const d = await res.json();
      if (!d.error) setMegaGws(d.megaGws);
    } catch (e) {}
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

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([loadClassicEntries(), loadH2hQualifiers(), loadRegistrations(), loadRebuys(), loadKnockouts(), loadMegaGws(), loadLogs(), reloadFinance()]);
    setRefreshing(false);
  };

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

  useEffect(() => {
    if (unlocked) refreshAll();
  }, [unlocked]);

  // ---------- LMS / Captaincy / Def+GK ----------
  const runAllForGw = async () => {
    const err = firstError([validateGw(gw)]);
    if (err) return showError(err);
    const result = await call("/api/admin/run-all-gw", { gw });
    if (result) {
      setDialog({
        type: result.status === "ok" ? "success" : "warning",
        title: result.status === "ok" ? "All three ran successfully" : "Ran with some issues",
        message: result.messages.join("\n\n"),
      });
      loadLogs();
    }
  };

  const runLms = async () => {
    const err = firstError([validateGw(gw)]);
    if (err) return showError(err);
    const result = await call("/api/admin/lms-run", { gw });
    if (result) {
      showSuccess(result.message || `LMS elimination recorded for GW${gw}.`);
      loadLogs();
    }
  };

  const runCaptaincy = async () => {
    const err = firstError([validateGw(captaincyGw)]);
    if (err) return showError(err);
    const result = await call("/api/admin/captaincy-run", { gw: captaincyGw });
    if (result) {
      showSuccess(`Captain accuracy and Captain Points recorded for ${result.recorded} managers in GW${captaincyGw}.`);
      loadLogs();
    }
  };

  const runDefGk = async () => {
    const err = firstError([validateGw(defgkGw)]);
    if (err) return showError(err);
    const result = await call("/api/admin/defgk-run", { gw: defgkGw });
    if (result) {
      showSuccess(`Def+GK points recorded for ${result.recorded} managers in GW${defgkGw}.`);
      loadLogs();
    }
  };

  // ---------- Registrations ----------
  const startEditReg = (r) => {
    setRegId(r.id);
    setRegName(r.manager_name);
    setRegPhone(r.phone || "");
    setRegTeam(r.fpl_team_name || "");
    setRegAmount(r.amount || "");
    setRegCurrency(r.currency || "INR");
    setRegPaidTo(r.paid_to || "");
  };
  const clearRegForm = () => {
    setRegId(null); setRegName(""); setRegPhone(""); setRegTeam(""); setRegAmount(""); setRegPaidTo("");
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
      action: regId ? "update" : "add", id: regId,
      managerName: regName, phone: regPhone, fplTeamName: regTeam,
      amount: Number(regAmount), currency: regCurrency, paidTo: regPaidTo, paid: true,
    });
    if (result) {
      showSuccess(regId ? `Registration updated for ${regName}.` : `Registration saved for ${regName} (${regTeam}).`);
      clearRegForm();
      loadRegistrations();
      loadLogs();
    }
  };
  const deleteRegistration = async (r) => {
    const result = await call("/api/admin/registration", { action: "delete", id: r.id });
    if (result) {
      showSuccess(`Registration for ${r.manager_name} deleted.`);
      loadRegistrations();
      loadLogs();
    }
  };

  // ---------- LMS Rebuy ----------
  const saveRebuy = async () => {
    if (!rebuyEntry) return showError("Select a team to record their rebuy.");
    const label = entryLabel(Number(rebuyEntry));
    const result = await call("/api/admin/rebuy", { action: "add", entryId: Number(rebuyEntry), entryName: label, paid: true });
    if (result) {
      showSuccess(`Rebuy recorded for ${label}.`);
      setRebuyEntry("");
      loadRebuys();
      loadLogs();
    }
  };
  const deleteRebuy = async (r) => {
    const result = await call("/api/admin/rebuy", { action: "delete", entryId: r.entry_id, entryName: r.entry_name });
    if (result) {
      showSuccess(`Rebuy entry for ${r.entry_name} removed.`);
      loadRebuys();
      loadLogs();
    }
  };

  // ---------- H2H Knockout ----------
  const startEditKo = (r) => {
    setKoId(r.id); setKoCup(r.cup); setKoRound(r.round); setKoGw(String(r.gw));
    setKoEntry1(String(r.entry_id_1)); setKoEntry2(String(r.entry_id_2));
    setKoScore1(r.score_1 ?? ""); setKoScore2(r.score_2 ?? "");
  };
  const clearKoForm = () => {
    setKoId(null); setKoGw(""); setKoEntry1(""); setKoEntry2(""); setKoScore1(""); setKoScore2("");
  };
  const saveKnockout = async () => {
    const err = firstError([validateGw(koGw)]);
    if (err) return showError(err);
    if (!koEntry1 || !koEntry2) return showError("Select both teams for this fixture.");
    if (koEntry1 === koEntry2) return showError("The two teams in a fixture can't be the same team.");

    const result = await call("/api/admin/h2h-knockout", {
      action: koId ? "update" : "add", id: koId,
      cup: koCup, round: koRound, gw: koGw,
      entryId1: Number(koEntry1), entryId2: Number(koEntry2),
      score1: koScore1 !== "" ? Number(koScore1) : null,
      score2: koScore2 !== "" ? Number(koScore2) : null,
      winnerEntryId: koScore1 !== "" && koScore2 !== "" ? (Number(koScore1) > Number(koScore2) ? Number(koEntry1) : Number(koEntry2)) : null,
    });
    if (result) {
      showSuccess(koId ? "Knockout result updated." : "Knockout result saved.");
      clearKoForm();
      loadKnockouts();
      loadLogs();
    }
  };
  const deleteKnockout = async (r) => {
    const result = await call("/api/admin/h2h-knockout", { action: "delete", id: r.id });
    if (result) {
      showSuccess("Knockout result deleted.");
      loadKnockouts();
      loadLogs();
    }
  };

  // ---------- Mega GW ----------
  const saveMegaGw = async () => {
    const err = firstError([validateGw(megaGwGw), validateRequired(megaGwLabel, "Label")]);
    if (err) return showError(err);
    const result = await call("/api/admin/mega-gw", {
      action: "add", gw: megaGwGw, label: megaGwLabel,
      prizeAmountInr: megaGwPrize ? Number(megaGwPrize) : null,
    });
    if (result) {
      showSuccess(`GW${megaGwGw} marked as a Mega GW.`);
      setMegaGwGw(""); setMegaGwLabel(""); setMegaGwPrize("");
      loadMegaGws();
      loadLogs();
    }
  };
  const deleteMegaGw = async (mg) => {
    const result = await call("/api/admin/mega-gw", { action: "delete", id: mg.id });
    if (result) {
      showSuccess(`Mega GW at GW${mg.gw} removed.`);
      loadMegaGws();
      loadLogs();
    }
  };

  // ---------- Finance ----------
  const savePool = async () => {
    const err = firstError([validatePositiveNumber(totalPlayers, "Total players"), validatePositiveNumber(buyinInr, "Buy-in INR")]);
    if (err) return showError(err);
    const result = await call("/api/admin/finance", {
      action: "setPool", totalPlayers: Number(totalPlayers), buyinInr: Number(buyinInr),
      buyinUsd: Number(buyinUsd) || 0, adminFeesInr: Number(adminFeesInr) || 0,
    });
    if (result) { showSuccess("Prize pool settings saved."); reloadFinance(); }
  };
  const startEditPayout = (p) => {
    setEditingPayoutKey(p.prize_key);
    setEditingPayoutPaid(p.paid);
    setPrizeKey(p.prize_key);
    setPrizeLabel(p.prize_label);
    setWinnerName(p.winner_name);
    setAmount(String(p.amount));
    setAssignedAdmin(p.assigned_admin || "");
  };
  const clearPayoutForm = () => {
    setEditingPayoutKey(null); setEditingPayoutPaid(false);
    setPrizeKey(""); setPrizeLabel(""); setWinnerName(""); setAmount(""); setAssignedAdmin("");
  };
  const savePayout = async () => {
    const err = firstError([
      validateRequired(prizeKey, "Prize key"), validateRequired(prizeLabel, "Prize label"),
      validateRequired(winnerName, "Winner name"), validatePositiveNumber(amount, "Amount"),
    ]);
    if (err) return showError(err);
    // Editing an already-paid entry must not silently reset it to unpaid -
    // preserve whatever paid status it had unless the row's own "Mark
    // paid" button is what triggered the change.
    const result = await call("/api/admin/finance", {
      action: "upsertPayout", prizeKey, prizeLabel, winnerName, amount: Number(amount), assignedAdmin,
      paid: editingPayoutKey ? editingPayoutPaid : false,
    });
    if (result) {
      showSuccess(editingPayoutKey ? `Payout entry updated for ${winnerName}.` : `Payout entry saved for ${winnerName}.`);
      clearPayoutForm();
      reloadFinance();
    }
  };
  const markPayoutPaid = async (p) => {
    const result = await call("/api/admin/finance", {
      action: "upsertPayout", prizeKey: p.prize_key, prizeLabel: p.prize_label,
      winnerEntryId: p.winner_entry_id, winnerName: p.winner_name,
      amount: p.amount, currency: p.currency, assignedAdmin: p.assigned_admin, paid: true,
    });
    if (result) { showSuccess(`Marked ${p.winner_name}'s payout as paid.`); reloadFinance(); }
  };
  const deletePayout = async (p) => {
    const result = await call("/api/admin/finance", { action: "deletePayout", prizeKey: p.prize_key });
    if (result) {
      showSuccess(`Payout entry for ${p.winner_name} deleted.`);
      if (editingPayoutKey === p.prize_key) clearPayoutForm();
      reloadFinance();
    }
  };

  const exportExcel = () => {
    window.location.href = `/api/admin/export?password=${encodeURIComponent(password)}`;
  };

  const teamOptions = (
    <>
      <option value="">Select a team…</option>
      {classicEntries.map((e) => (
        <option key={e.entry} value={e.entry}>{e.managerName} ({e.entryName})</option>
      ))}
    </>
  );

  // Only lets an admin pick teams that actually qualified for the
  // selected cup - the previous free-text/any-team version is exactly
  // what made it possible to record a fixture for a team that isn't in
  // that bracket at all. Structurally impossible now, not just discouraged.
  const cupTeamOptions = (cup) => (
    <>
      <option value="">Select a {cup === "gold" ? "Gold" : "Silver"} Cup team…</option>
      {h2hQualifiers[cup].map((e) => (
        <option key={e.entry} value={e.entry}>{e.entryName} (rank {e.rank})</option>
      ))}
    </>
  );

  if (!unlocked) {
    return (
      <div className="container">
        <Dialog dialog={dialog} onClose={() => setDialog(null)} />
        <div className="card" style={{ maxWidth: 420, margin: "3rem auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>Admin</h1>
          <p className="muted">Enter the admin password to manage the whole league from here.</p>
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
  const recentLogs = logs.slice(0, 5);

  return (
    <div className="container">
      <Dialog dialog={dialog} onClose={() => setDialog(null)} />

      <div className="hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>Admin</h1>
          <p>Everything for running the league lives here - LMS, H2H, Mega GW, registrations, and finance, all behind this one password.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={refreshAll} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh data"}</button>
          <button onClick={exportExcel}>Export to Excel</button>
        </div>
      </div>

      {recentLogs.length > 0 && (
        <div className="card" style={{ padding: "14px 20px" }}>
          <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-2)", marginBottom: 8 }}>Recent activity</p>
          {recentLogs.map((l) => (
            <div key={l.id} style={{ fontSize: 13, padding: "3px 0", color: "var(--muted)" }}>
              <span style={{ color: l.success ? "var(--success)" : "var(--danger)" }}>●</span> {l.summary}
            </div>
          ))}
          {logs.length > 5 && (
            <button onClick={() => setShowFullLog((s) => !s)} style={{ marginTop: 10, fontSize: 12, padding: "6px 12px" }}>
              {showFullLog ? "Hide full log" : `Show full log (${logs.length})`}
            </button>
          )}
        </div>
      )}

      {showFullLog && logs.length > 5 && (
        <div className="card">
          <h2>Full activity log</h2>
          <div className="table-scroll"><table>
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
          </table></div>
        </div>
      )}

      <div className="card">
        <h2>Run everything for a gameweek</h2>
        <p className="muted">Runs LMS, Captain accuracy, and Def+GK together for one GW - the individual buttons below still exist if you only want one of them.</p>
        <input placeholder="Gameweek (1-38)" value={gw} onChange={(e) => setGw(e.target.value)} style={{ width: 160 }} />
        {" "}
        <button onClick={runAllForGw}>Run all for this GW</button>
      </div>

      <div className="card">
        <h2>Run LMS elimination</h2>
        <p className="muted">Only run after a GW locks and bonus points settle.</p>
        <input placeholder="Gameweek (1-38)" value={gw} onChange={(e) => setGw(e.target.value)} style={{ width: 160 }} />
        {" "}
        <button onClick={runLms}>Run elimination for this GW</button>
      </div>

      <div className="card">
        <h2>Run captain accuracy + Captain Points</h2>
        <p className="muted">One action powers both Perfect Captaincy and the season Captain Points total.</p>
        <input placeholder="Gameweek (1-38)" value={captaincyGw} onChange={(e) => setCaptaincyGw(e.target.value)} style={{ width: 160 }} />
        {" "}
        <button onClick={runCaptaincy}>Run for this GW</button>
      </div>

      <div className="card">
        <h2>Run Def+GK points</h2>
        <p className="muted">Tracked from whenever you first run this - earlier gameweeks aren't backfilled.</p>
        <input placeholder="Gameweek (1-38)" value={defgkGw} onChange={(e) => setDefgkGw(e.target.value)} style={{ width: 160 }} />
        {" "}
        <button onClick={runDefGk}>Run for this GW</button>
      </div>

      <div className="card">
        <h2>Mega GW</h2>
        <p className="muted">Mark a gameweek as an official Mega GW. The winner is calculated automatically once that GW is played - you're only marking which GWs count.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input placeholder="Gameweek" value={megaGwGw} onChange={(e) => setMegaGwGw(e.target.value)} style={{ width: 110 }} />
          <input placeholder="Label, e.g. Double Gameweek" value={megaGwLabel} onChange={(e) => setMegaGwLabel(e.target.value)} />
          <input placeholder="Prize amount INR (optional)" value={megaGwPrize} onChange={(e) => setMegaGwPrize(e.target.value)} style={{ width: 180 }} />
        </div>
        <button onClick={saveMegaGw}>Add Mega GW</button>

        {megaGws.length > 0 && (
          <div className="table-scroll" style={{ marginTop: 14 }}><table>
            <thead><tr><th>GW</th><th>Label</th><th>Prize</th><th></th></tr></thead>
            <tbody>
              {megaGws.map((mg) => (
                <tr key={mg.id}>
                  <td>{mg.gw}</td>
                  <td>{mg.label}</td>
                  <td>{mg.prizeAmountInr ? `₹${mg.prizeAmountInr}` : "—"}</td>
                  <td><button onClick={() => deleteMegaGw(mg)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="card">
        <h2>H2H knockout results</h2>
        <p className="muted">FPL doesn't know about your custom Gold/Silver bracket - enter each round's result once it's played. Team dropdowns only show managers who actually qualified for the selected cup, so it's not possible to accidentally record a fixture for the wrong bracket.</p>
        {h2hQualifiers.gold.length === 0 && h2hQualifiers.silver.length === 0 && (
          <p className="error" style={{ marginBottom: 8 }}>No qualifiers yet - the group stage runs through GW30, so team lists here stay empty until then.</p>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <select value={koCup} onChange={(e) => { setKoCup(e.target.value); setKoEntry1(""); setKoEntry2(""); }}>
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
          <select value={koEntry1} onChange={(e) => setKoEntry1(e.target.value)} style={{ minWidth: 200 }}>{cupTeamOptions(koCup)}</select>
          <input placeholder="Score" value={koScore1} onChange={(e) => setKoScore1(e.target.value)} style={{ width: 90 }} />
          <select value={koEntry2} onChange={(e) => setKoEntry2(e.target.value)} style={{ minWidth: 200 }}>{cupTeamOptions(koCup)}</select>
          <input placeholder="Score" value={koScore2} onChange={(e) => setKoScore2(e.target.value)} style={{ width: 90 }} />
        </div>
        <button onClick={saveKnockout}>{koId ? "Update result" : "Save result"}</button>
        {koId && <button onClick={clearKoForm} style={{ marginLeft: 8 }}>Cancel edit</button>}

        {knockouts.length > 0 && (
          <div className="table-scroll" style={{ marginTop: 14 }}><table>
            <thead><tr><th>Cup</th><th>Round</th><th>GW</th><th>Fixture</th><th>Score</th><th></th></tr></thead>
            <tbody>
              {knockouts.map((r) => (
                <tr key={r.id}>
                  <td style={{ textTransform: "capitalize" }}>{r.cup}</td>
                  <td>{r.round}</td>
                  <td>{r.gw}</td>
                  <td>{entryLabel(r.entry_id_1)} vs {entryLabel(r.entry_id_2)}</td>
                  <td>{r.score_1 ?? "—"} - {r.score_2 ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => startEditKo(r)}>Edit</button>{" "}
                    <button onClick={() => deleteKnockout(r)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
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
        <button onClick={saveRegistration}>{regId ? "Update registration" : "Save registration"}</button>
        {regId && <button onClick={clearRegForm} style={{ marginLeft: 8 }}>Cancel edit</button>}

        <div style={{ marginTop: 18, borderTop: "0.5px solid var(--border)", paddingTop: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>All registrations ({registrations.length})</p>
          {registrations.length === 0 ? (
            <p className="muted">No registrations saved yet.</p>
          ) : (
            <div className="table-scroll"><table>
              <thead><tr><th>Manager</th><th>Team</th><th>Phone</th><th>Amount</th><th>Paid to</th><th></th></tr></thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id}>
                    <td>{r.manager_name}</td>
                    <td>{r.fpl_team_name}</td>
                    <td>{r.phone}</td>
                    <td>{r.currency === "USD" ? "$" : "₹"}{r.amount}</td>
                    <td>{r.paid_to}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button onClick={() => startEditReg(r)}>Edit</button>{" "}
                      <button onClick={() => deleteRegistration(r)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>LMS rebuy</h2>
        <select value={rebuyEntry} onChange={(e) => setRebuyEntry(e.target.value)} style={{ minWidth: 240 }}>{teamOptions}</select>
        {" "}
        <button onClick={saveRebuy}>Mark ₹500 paid</button>

        {rebuys.length > 0 && (
          <div className="table-scroll" style={{ marginTop: 14 }}><table>
            <thead><tr><th>Team</th><th>Paid?</th><th></th></tr></thead>
            <tbody>
              {rebuys.map((r) => (
                <tr key={r.entry_id}>
                  <td>{r.entry_name}</td>
                  <td>{r.paid ? <span className="pill alive">Paid</span> : <span className="pill out">Unpaid</span>}</td>
                  <td><button onClick={() => deleteRebuy(r)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
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
          <button onClick={savePayout}>{editingPayoutKey ? "Update payout" : "Save as unpaid"}</button>
          {editingPayoutKey && <button onClick={clearPayoutForm} style={{ marginLeft: 8 }}>Cancel edit</button>}
        </div>

        {finance && finance.payouts.length > 0 && (
          <div className="table-scroll"><table>
            <thead><tr><th>Prize</th><th>Winner</th><th>Amount</th><th>Admin</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {finance.payouts.map((p) => (
                <tr key={p.id}>
                  <td>{p.prize_label}</td>
                  <td>{p.winner_name}</td>
                  <td>₹{Number(p.amount).toLocaleString()}</td>
                  <td>{p.assigned_admin || "—"}</td>
                  <td>{p.paid ? <span className="pill alive">Paid</span> : <span className="pill out">Owed</span>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {!p.paid && <button onClick={() => markPayoutPaid(p)}>Mark paid</button>}{" "}
                    <button onClick={() => startEditPayout(p)}>Edit</button>{" "}
                    <button onClick={() => deletePayout(p)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
