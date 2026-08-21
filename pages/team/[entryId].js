import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const CHIP_LABELS = { wildcard: "Wildcard", freehit: "Free Hit", bboost: "Bench Boost", "3xc": "Triple Captain" };
const TYPE_LABELS = { 1: "Goalkeeper", 2: "Defenders", 3: "Midfielders", 4: "Forwards" };

function Crest({ code, size = 18 }) {
  const [failed, setFailed] = useState(false);
  if (!code || failed) return null;
  return (
    <img
      src={`https://resources.premierleague.com/premierleague/badges/70/t${code}.png`}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: "contain", flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}

function PlayerCard({ p }) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: p.isCaptain ? "1px solid var(--accent-bright)" : "1px solid var(--border)",
        borderRadius: 10,
        padding: "8px 10px",
        minWidth: 92,
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
        <Crest code={p.teamCode} />
        {p.isCaptain && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-bright)" }}>(C)</span>}
        {p.isViceCaptain && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>(VC)</span>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-bright)", marginTop: 2 }}>{p.livePoints}</div>
      {p.multiplier > 1 && <div style={{ fontSize: 9, color: "var(--muted-2)" }}>{p.basePoints} × {p.multiplier}</div>}
    </div>
  );
}

export default function TeamView() {
  const router = useRouter();
  const { entryId, gw } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gwInput, setGwInput] = useState("");

  const load = (targetGw) => {
    if (!entryId) return;
    setLoading(true);
    setError(null);
    const q = targetGw ? `&gw=${targetGw}` : "";
    fetch(`/api/fpl/team?entryId=${entryId}${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else { setData(d); setGwInput(String(d.gw)); }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(gw); }, [entryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const byType = (list, type) => list.filter((p) => p.elementType === type);

  return (
    <div className="container">
      <div className="hero">
        <p style={{ marginBottom: 8 }}><Link href="/" style={{ color: "var(--muted)", fontSize: 13 }}>← Back to standings</Link></p>
        <h1>{data ? data.teamName : "Team"}</h1>
        <p>{data ? `${data.managerName} · GW${data.gw}` : "Loading…"}</p>
      </div>

      {error && (
        <div className="card error">
          <p>{error}</p>
        </div>
      )}

      {loading && !error && <div className="card muted">Loading team…</div>}

      {data && !loading && (
        <>
          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div className="label" style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted-2)" }}>
                {data.chip ? "Chip active" : "Live total"}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {data.totalLivePoints} pts
                {data.chip && <span className="pill admin" style={{ marginLeft: 10, fontSize: 12 }}>{CHIP_LABELS[data.chip] || data.chip}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                placeholder={`GW (1-${data.latestLockedGw})`}
                value={gwInput}
                onChange={(e) => setGwInput(e.target.value)}
                style={{ width: 130 }}
              />
              <button onClick={() => load(gwInput)}>View this GW</button>
            </div>
          </div>

          <div className="card">
            <h2>Starting XI</h2>
            {[1, 2, 3, 4].map((type) => {
              const players = byType(data.startingXI, type);
              if (players.length === 0) return null;
              return (
                <div key={type} style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 11, color: "var(--muted-2)", textTransform: "uppercase", marginBottom: 8 }}>{TYPE_LABELS[type]}</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                    {players.map((p) => <PlayerCard key={p.elementId} p={p} />)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <h2>Bench</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {data.bench.map((p) => <PlayerCard key={p.elementId} p={p} />)}
            </div>
            {data.chip !== "bboost" && (
              <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>Bench points don't count toward the live total unless Bench Boost is active.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
