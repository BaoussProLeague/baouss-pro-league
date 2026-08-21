import { useState } from "react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import InfoTip from "../components/InfoTip";
import TruncateText from "../components/TruncateText";
import { PRIZE_CATALOG, statusLabel } from "../lib/prizeCatalog";

const CHIP_KEY_MAP = { wildcard: "wildcard", freehit: "freeHit", "3xc": "tripleCaptain", bboost: "benchBoost" };

export default function Prizes() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [captaincy, setCaptaincy] = useState(null);
  const [captainPoints, setCaptainPoints] = useState(null);
  const [defGk, setDefGk] = useState(null);
  const [megaGws, setMegaGws] = useState(null);

  const load = () => {
    setError(null);
    fetch("/api/prizes/summary")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));

    fetch("/api/prizes/captaincy")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) { setCaptaincy(d.leaderboard); setCaptainPoints(d.captainPoints); }
      })
      .catch(() => {});

    fetch("/api/prizes/defgk")
      .then((r) => r.json())
      .then((d) => !d.error && setDefGk(d.leaderboard))
      .catch(() => {});

    fetch("/api/prizes/mega-gw")
      .then((r) => r.json())
      .then((d) => !d.error && setMegaGws(d.megaGws))
      .catch(() => {});
  };

  useAutoRefresh(load, 60000);

  const rowsFor = (key) => {
    if (!data) return null;
    if (key === "teamValue") return data.teamValue.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `£${r.value.toFixed(1)}m` }));
    if (key === "benchPoints") return data.benchPoints.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.benchPoints} pts` }));
    if (key === "first1499") return data.first1499.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `GW${r.gwReached}` }));
    if (key === "leastTransferCost") return data.leastTransferCost.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `-${r.hitCost} pts` }));
    if (key === "wildcardVision") return data.wildcardVision.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.total} pts${r.complete ? "" : " (in progress)"}` }));
    if (key === "comebackKing") return data.comebackKing.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `+${r.jump} places` }));
    if (key === "perfectCaptaincy" && captaincy) return captaincy.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.perfectCalls}/${r.gwsTracked} GWs` }));
    if (key === "captainPoints" && captainPoints) return captainPoints.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.totalCaptainPoints} pts` }));
    if (key === "defGk" && defGk) return defGk.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.totalPoints} pts` }));

    const chipKey = Object.entries(CHIP_KEY_MAP).find(([, v]) => v === key)?.[0];
    if (chipKey && data.chips) return data.chips[chipKey].leaderboard.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.score} pts (GW${r.gw})` }));

    if (key === "motm" && data.currentMonth && data.motm[data.currentMonth]) {
      return data.motm[data.currentMonth].map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.points} pts` }));
    }
    if (key === "rankJumpMonth" && data.currentMonth && data.rankJumpByMonth[data.currentMonth]) {
      return data.rankJumpByMonth[data.currentMonth].map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.jump >= 0 ? "+" : ""}${r.jump} places` }));
    }
    return null;
  };

  return (
    <div className="container">
      <div className="hero">
        <h1>All prizes</h1>
        <p>Every prize category in the league, including the ones not yet wired up to live data. Hover the <strong>?</strong> next to a prize name for the exact rule.</p>
      </div>

      {error && (
        <div className="card error">
          <p style={{ marginBottom: 10 }}>Couldn't load prize data: {error}</p>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {megaGws && megaGws.length > 0 && (
        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center" }}>
            Mega GW results
            <InfoTip text="Specific gameweeks announced ahead of time where the highest net score wins, regardless of overall league position." />
          </h2>
          <div className="table-scroll"><table>
            <thead><tr><th>GW</th><th>Label</th><th>Status</th><th>Winner</th><th>Score</th></tr></thead>
            <tbody>
              {megaGws.map((mg) => (
                <tr key={mg.id}>
                  <td>{mg.gw}</td>
                  <td><TruncateText text={mg.label} maxWidth={180} /></td>
                  <td>{mg.status === "completed" ? <span className="pill alive">Completed</span> : <span className="pill admin">Upcoming</span>}</td>
                  <td>{mg.leaderboard[0] ? <TruncateText text={mg.leaderboard[0].entryName} maxWidth={150} href={`/team/${mg.leaderboard[0].entry}`} /> : "—"}</td>
                  <td>{mg.leaderboard[0] ? `${mg.leaderboard[0].points} pts` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <div className="grid">
        {PRIZE_CATALOG.filter((p) => p.key !== "classic" && p.key !== "lms" && p.key !== "h2h" && p.key !== "megaGw").map((prize) => {
          const rows = rowsFor(prize.key);
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

              {rows && rows.length > 0 ? (
                <div className="table-scroll"><table>
                  <tbody>
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={row.entry}>
                        <td>{i + 1}. <TruncateText text={row.entryName} maxWidth={150} href={`/team/${row.entry}`} /></td>
                        <td style={{ textAlign: "right" }}>{row.display}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              ) : (
                <p className="muted">
                  {prize.status === "planned"
                    ? "Not built yet - see the project README."
                    : prize.status === "admin"
                    ? "No data yet - waiting on the admin to run this GW's check."
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
