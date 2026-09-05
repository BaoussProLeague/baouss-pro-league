import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import PlayerPhoto from "../../components/PlayerPhoto";
import ErrorCard from "../../components/ErrorCard";

const CHIP_LABELS = { wildcard: "Wildcard", freehit: "Free Hit", bboost: "Bench Boost", "3xc": "Triple Captain" };
const TYPE_LABELS = { 1: "Goalkeeper", 2: "Defenders", 3: "Midfielders", 4: "Forwards" };

function Crest({ code, size = 16 }) {
  const [failed, setFailed] = useState(false);
  if (!code || failed) return null;
  return (
    <img
      src={`https://resources.premierleague.com/premierleague/badges/70/t${code}.png`}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

function PlayerCard({ p }) {
  // The same root cause as the Def+GK bug: livePoints is base x FPL's
  // own multiplier, which is 0 for a bench player unless Bench Boost is
  // active. Showing that on a bench card looked like "this player
  // scored nothing" when they may well have scored plenty - they just
  // don't count toward the real total from the bench. Only the captain
  // needs the multiplied number (that's the whole point of seeing it
  // doubled/tripled); everyone else, bench included, shows what they
  // actually earned.
  const displayPoints = p.isCaptain ? p.livePoints : p.basePoints;
  const pointsDisplay = p.fixture && !p.fixture.started
    ? p.fixture.label
    : `${displayPoints}`;

  return (
    <Link
      href={`/player/${p.elementId}`}
      style={{
        background: "var(--bg-elevated)",
        border: p.isCaptain ? "1px solid var(--accent-bright)" : "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 6px 8px",
        textAlign: "center",
        display: "block",
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <div style={{ marginBottom: 4 }}>
        <Crest code={p.teamCode} />
      </div>
      <PlayerPhoto photoCode={p.photoCode} name={p.name} />
      <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {p.name}
        {p.isCaptain && <span style={{ color: "var(--accent-bright)" }}> (C)</span>}
        {p.isViceCaptain && <span style={{ color: "var(--muted)" }}> (VC)</span>}
      </div>
      <div style={{
        fontSize: p.fixture && !p.fixture.started ? 11 : 15,
        fontWeight: 700,
        color: p.fixture && !p.fixture.started ? "var(--muted)" : "var(--accent-bright)",
        marginTop: 3,
      }}>
        {pointsDisplay}
      </div>
    </Link>
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
    fetch(`/api/fpl/team?entryId=${entryId}${q}`, { cache: "no-store" })
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

  // Fixed grid columns per row - the previous flex-wrap version let card
  // widths vary just enough that rows wrapped unevenly (3 defenders on
  // one line, 2+1 on the next). A grid with an explicit column count per
  // position row is predictable regardless of how many players are in it.
  const rowGrid = (count) => ({
    display: "grid",
    gridTemplateColumns: `repeat(${Math.min(count, 5)}, minmax(78px, 1fr))`,
    gap: 8,
    maxWidth: Math.min(count, 5) * 100,
    margin: "0 auto",
  });

  return (
    <div className="container">
      <div className="hero">
        <p style={{ marginBottom: 8 }}>
          <a onClick={() => router.back()} style={{ color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>← Back</a>
        </p>
        <h1>{data ? data.teamName : "Team"}</h1>
        <p>{data ? `${data.managerName} · GW${data.gw}` : "Loading…"}</p>
      </div>

      {error && <ErrorCard error={error} onRetry={() => load(gw)} label="load this team" />}

      {loading && !error && <div className="card muted">Loading team…</div>}

      {data && !loading && (
        <>
          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div className="label" style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted-2)" }}>Live total</div>
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
                  <p style={{ fontSize: 11, color: "var(--muted-2)", textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>{TYPE_LABELS[type]}</p>
                  <div style={rowGrid(players.length)}>
                    {players.map((p) => <PlayerCard key={p.elementId} p={p} />)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <h2>Bench</h2>
            <div style={rowGrid(data.bench.length)}>
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
