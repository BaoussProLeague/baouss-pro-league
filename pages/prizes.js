import { useEffect, useState } from "react";
import InfoTip from "../components/InfoTip";
import { PRIZE_CATALOG, statusLabel } from "../lib/prizeCatalog";

const LIVE_TABLES = [
  { key: "teamValue", col: "value", fmt: (v) => `£${v.toFixed(1)}m` },
  { key: "benchPoints", col: "benchPoints", fmt: (v) => v },
  { key: "first999", col: "gwReached", fmt: (v) => `GW${v}` },
  { key: "first1499", col: "gwReached", fmt: (v) => `GW${v}` },
];

const CHIP_KEY_MAP = { wildcard: "wildcard", freehit: "freeHit", "3xc": "tripleCaptain", bboost: "benchBoost" };

export default function Prizes() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [captaincy, setCaptaincy] = useState(null);

  const load = () => {
    setError(null);
    fetch("/api/prizes/summary")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));

    fetch("/api/prizes/captaincy")
      .then((r) => r.json())
      .then((d) => !d.error && setCaptaincy(d.leaderboard))
      .catch(() => {});
  };

  useEffect(load, []);

  const leaderboardFor = (prizeKey) => {
    if (!data) return null;
    const live = LIVE_TABLES.find((l) => l.key === prizeKey);
    if (live) return { rows: data[live.key], fmt: live.fmt, col: live.col };
    const chipKey = Object.entries(CHIP_KEY_MAP).find(([, v]) => v === prizeKey)?.[0];
    if (chipKey && data.chips) return { rows: data.chips[chipKey].leaderboard, fmt: (r) => `${r.score} pts (GW${r.gw})`, col: null, isChip: true };
    if (prizeKey === "perfectCaptaincy" && captaincy) return { rows: captaincy, fmt: null, isCaptaincy: true };
    return null;
  };

  return (
    <div className="container">
      <div className="hero">
        <h1>All prizes</h1>
        <p>Every prize category in the league, including ones not yet wired up to live data - hover the <strong>?</strong> next to a prize name for the exact rule.</p>
      </div>

      {error && (
        <div className="card error">
          <p style={{ marginBottom: 10 }}>Couldn't load prize data: {error}</p>
          <button onClick={load}>Retry</button>
        </div>
      )}

      <div className="grid">
        {PRIZE_CATALOG.map((prize) => {
          const board = leaderboardFor(prize.key);
          const status = statusLabel(prize.status);
          return (
            <div className="card" key={prize.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <h2 style={{ marginBottom: 0, display: "flex", alignItems: "center" }}>
                  {prize.label}
                  <InfoTip text={prize.description} />
                </h2>
                <span className={status.className}>{status.text}</span>
              </div>

              {board && board.rows && board.rows.length > 0 ? (
                <table>
                  <tbody>
                    {board.rows.slice(0, 5).map((row, i) => (
                      <tr key={row.entry}>
                        <td>{i + 1}. {row.entryName}</td>
                        <td style={{ textAlign: "right" }}>
                          {board.isCaptaincy
                            ? `${row.perfectCalls}/${row.gwsTracked} GWs`
                            : board.fmt(board.col ? row[board.col] : row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">
                  {prize.status === "planned"
                    ? "Not built yet - see the project README for the plan."
                    : "No data yet this season."}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
