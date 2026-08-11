import { useState } from "react";
import Link from "next/link";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [gw, setGw] = useState("");
  const [entryId, setEntryId] = useState("");
  const [entryName, setEntryName] = useState("");
  const [captaincyGw, setCaptaincyGw] = useState("");
  const [log, setLog] = useState([]);

  // Registration form fields
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regTeam, setRegTeam] = useState("");
  const [regAmount, setRegAmount] = useState("");
  const [regCurrency, setRegCurrency] = useState("INR");
  const [regPaidTo, setRegPaidTo] = useState("");

  // H2H knockout form fields
  const [koCup, setKoCup] = useState("gold");
  const [koRound, setKoRound] = useState("r16");
  const [koGw, setKoGw] = useState("");
  const [koEntry1, setKoEntry1] = useState("");
  const [koEntry2, setKoEntry2] = useState("");
  const [koScore1, setKoScore1] = useState("");
  const [koScore2, setKoScore2] = useState("");

  const call = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, ...body }),
    });
    const data = await res.json();
    setLog((l) => [{ time: new Date().toLocaleTimeString(), url, data }, ...l]);
  };

  return (
    <div className="container">
      <div className="card">
        <h1>Admin</h1>
        <p className="muted">This page is only as secure as ADMIN_PASSWORD - fine for a private friends league, not for anything sensitive.</p>
        <input type="password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {" "}
        <Link href="/admin/finance">
          <button>Open Finance (private, separate password prompt)</button>
        </Link>
      </div>

      <div className="card">
        <h2>Run LMS Elimination</h2>
        <p className="muted">Only run this after a gameweek's scores are final (bonus points confirmed, usually ~2 days after the last match).</p>
        <input placeholder="Gameweek number" value={gw} onChange={(e) => setGw(e.target.value)} style={{ width: 160 }} />
        {" "}
        <button onClick={() => call("/api/admin/lms-run", { gw })}>Run elimination for this GW</button>
      </div>

      <div className="card">
        <h2>Run Captain Accuracy Check (Perfect Captaincy)</h2>
        <p className="muted">Same timing rule as LMS — only run after the GW locks, so late bonus points don't flip the captain call.</p>
        <input placeholder="Gameweek number" value={captaincyGw} onChange={(e) => setCaptaincyGw(e.target.value)} style={{ width: 160 }} />
        {" "}
        <button onClick={() => call("/api/admin/captaincy-run", { gw: captaincyGw })}>Run for this GW</button>
      </div>

      <div className="card">
        <h2>Record H2H Knockout Result</h2>
        <p className="muted">FPL doesn't know about your custom Gold/Silver bracket — enter each round's result once it's played.</p>
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
              cup: koCup,
              round: koRound,
              gw: koGw,
              entryId1: Number(koEntry1),
              entryId2: Number(koEntry2),
              score1: koScore1 ? Number(koScore1) : null,
              score2: koScore2 ? Number(koScore2) : null,
              winnerEntryId:
                koScore1 && koScore2
                  ? Number(koScore1) > Number(koScore2)
                    ? Number(koEntry1)
                    : Number(koEntry2)
                  : null,
            })
          }
        >
          Save result
        </button>
      </div>

      <div className="card">
        <h2>Add Registration</h2>
        <p className="muted">Replaces the Form responses + RegistrationPayments sheets. Contains phone numbers — this list is admin-only.</p>
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
              managerName: regName,
              phone: regPhone,
              fplTeamName: regTeam,
              amount: regAmount ? Number(regAmount) : null,
              currency: regCurrency,
              paidTo: regPaidTo,
              paid: true,
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
