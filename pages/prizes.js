import { useState } from "react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import InfoTip from "../components/InfoTip";
import TruncateText from "../components/TruncateText";
import RankArrow from "../components/RankArrow";
import { PRIZE_CATALOG } from "../lib/prizeCatalog";

const CHIP_KEY_MAP = { wildcard: "wildcard", freehit: "freeHit", "3xc": "tripleCaptain", bboost: "benchBoost" };

// Contextual LIVE logic: a prize only gets the badge when something about
// it can genuinely change in the next few minutes, not just because it's
// gameweek week in general. Season-cumulative prizes that only advance
// once a GW fully finalizes (Team Value, Bench Points, Least Transfer
// Cost, First to 1499, Wildcard Vision, monthly prizes) never show LIVE -
// that would be advertising movement the data doesn't actually have yet.
function isPrizeLive(key, data, chipsData) {
  if (!data || !data.liveNow) return false;
  if (["captainPoints", "perfectCaptaincy", "defGk"].includes(key)) return true;
  const chipKey = Object.entries(CHIP_KEY_MAP).find(([, v]) => v === key)?.[0];
  if (chipKey && chipsData && chipsData[chipKey]) {
    return chipsData[chipKey].leaderboard.some((r) => r.isLive);
  }
  return false;
}

export default function Prizes() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [captaincy, setCaptaincy] = useState(null);
  const [captainPoints, setCaptainPoints] = useState(null);
  const [captaincyDeltas, setCaptaincyDeltas] = useState({});
  const [captainPointsDeltas, setCaptainPointsDeltas] = useState({});
  const [defGk, setDefGk] = useState(null);
  const [defGkDeltas, setDefGkDeltas] = useState({});
  const [megaGws, setMegaGws] = useState(null);

  const load = () => {
    setError(null);
    fetch("/api/prizes/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(e.message));

    fetch("/api/prizes/captaincy", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setCaptaincy(d.leaderboard); setCaptainPoints(d.captainPoints);
          setCaptaincyDeltas(d.leaderboardDeltas || {}); setCaptainPointsDeltas(d.captainPointsDeltas || {});
        }
      })
      .catch(() => {});

    fetch("/api/prizes/defgk", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!d.error) { setDefGk(d.leaderboard); setDefGkDeltas(d.deltas || {}); } })
      .catch(() => {});

    fetch("/api/prizes/mega-gw", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !d.error && setMegaGws(d.megaGws))
      .catch(() => {});
  };

  useAutoRefresh(load, 60000);

  const rowsFor = (key) => {
    if (!data) return null;
    const d = data.deltas || {};
    if (key === "teamValue") return data.teamValue.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `£${r.value.toFixed(1)}m`, delta: d.teamValue?.[r.entry] }));
    if (key === "benchPoints") return data.benchPoints.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.benchPoints} pts`, delta: d.benchPoints?.[r.entry] }));
    if (key === "first1499") return data.first1499.map((r) => ({ entry: r.entry, entryName: r.entryName, gw: r.gwReached, display: `GW${r.gwReached}${r.isLive ? " · live" : ""}` }));
    if (key === "leastTransferCost") return data.leastTransferCost.map((r) => ({ entry: r.entry, entryName: r.entryName, display: r.hitCost > 0 ? `-${r.hitCost} pts` : "0 pts", delta: d.leastTransferCost?.[r.entry] }));
    if (key === "wildcardVision") return data.wildcardVision.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.total} pts${r.complete ? "" : " (in progress)"}` }));
    if (key === "comebackKing") return data.comebackKing.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `+${r.jump} places` }));
    if (key === "perfectCaptaincy" && captaincy) return captaincy.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.perfectCalls}/${r.gwsTracked} GWs`, delta: captaincyDeltas[r.entry] }));
    if (key === "captainPoints" && captainPoints) return captainPoints.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.totalCaptainPoints} pts${r.tripleCaptainCount > 0 ? " (incl. TC)" : ""}`, delta: captainPointsDeltas[r.entry] }));
    if (key === "defGk" && defGk) return defGk.map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.totalPoints} pts`, delta: defGkDeltas[r.entry] }));

    const chipKey = Object.entries(CHIP_KEY_MAP).find(([, v]) => v === key)?.[0];
    if (chipKey && data.chips) return data.chips[chipKey].leaderboard.map((r) => ({ entry: r.entry, entryName: r.entryName, gw: r.gw, display: `${r.score} pts (GW${r.gw})${r.isLive ? " · live" : ""}` }));

    if (key === "motm" && data.currentMonth && data.motm[data.currentMonth]) {
      return data.motm[data.currentMonth].map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.points} pts` }));
    }
    if (key === "rankJumpMonth" && data.currentMonth && data.rankJumpByMonth[data.currentMonth]) {
      return data.rankJumpByMonth[data.currentMonth].map((r) => ({ entry: r.entry, entryName: r.entryName, display: `${r.jump >= 0 ? "+" : ""}${r.jump} places` }));
    }
    return null;
  };

  const liveMegaGw = megaGws && megaGws.find((mg) => mg.status === "live");

  return (
    <div className="container">
      <div className="hero">
        <h1>All prizes</h1>
        <p>Every prize category in the league. Hover the <strong>?</strong> next to a prize name for the exact rule. A LIVE badge only appears when a live match can genuinely still move that prize right now.</p>
      </div>

      {error && (
        <div className="card error">
          <p style={{ marginBottom: 10 }}>Couldn't load prize data: {error}</p>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {liveMegaGw && (
        <div className="card" style={{ borderColor: "var(--accent-bright)" }}>
          <h2 style={{ display: "flex", alignItems: "center" }}>
            <span className="pill alive" style={{ marginRight: 8 }}>LIVE</span>
            {liveMegaGw.label} — current top 5
          </h2>
          {liveMegaGw.leaderboard.length === 0 ? (
            <p className="muted">No live scores yet - check back once kickoff happens.</p>
          ) : (
            <div className="table-scroll"><table>
              <tbody>
                {liveMegaGw.leaderboard.map((row, i) => (
                  <tr key={row.entry}>
                    <td>{i + 1}. <TruncateText text={row.entryName} maxWidth={180} href={`/team/${row.entry}`} /></td>
                    <td style={{ textAlign: "right" }}>{row.points} pts</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {megaGws && megaGws.length > 0 && (
        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center" }}>
            Mega GW results
            <InfoTip text="Specific gameweeks announced ahead of time where the highest net score wins, regardless of overall league position." />
          </h2>
          <div className="table-scroll"><table>
            <thead><tr><th>GW</th><th>Label</th><th>Prize</th><th>Status</th><th>Winner</th><th>Score</th></tr></thead>
            <tbody>
              {megaGws.map((mg) => (
                <tr key={mg.id}>
                  <td>{mg.gw}</td>
                  <td><TruncateText text={mg.label} maxWidth={160} /></td>
                  <td>{mg.prizeAmountInr ? `₹${mg.prizeAmountInr.toLocaleString()}` : "—"}</td>
                  <td>
                    {mg.status === "completed" && <span className="pill alive">Completed</span>}
                    {mg.status === "live" && <span className="pill alive">LIVE</span>}
                    {mg.status === "upcoming" && <span className="pill admin">Yet to start</span>}
                  </td>
                  <td>{mg.leaderboard[0] ? <TruncateText text={mg.leaderboard[0].entryName} maxWidth={140} href={`/team/${mg.leaderboard[0].entry}`} /> : "—"}</td>
                  <td>{mg.leaderboard[0] ? `${mg.leaderboard[0].points} pts` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {data && data.motmCompletedMonths && data.motmCompletedMonths.length > 0 && (
        <div className="card">
          <h2>Manager of the Month</h2>
          <div className="table-scroll"><table>
            <thead><tr><th>Month</th><th>Winner</th><th>Points</th></tr></thead>
            <tbody>
              {data.motmCompletedMonths.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td><TruncateText text={m.winner.entryName} maxWidth={180} href={`/team/${m.winner.entry}`} /></td>
                  <td>{m.winner.points} pts</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <div className="grid">
        {PRIZE_CATALOG.filter((p) => p.key !== "classic" && p.key !== "lms" && p.key !== "h2h" && p.key !== "megaGw" && p.key !== "motm").map((prize) => {
          const rows = rowsFor(prize.key);
          const live = isPrizeLive(prize.key, data, data?.chips);
          return (
            <div className="card" key={prize.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <h2 style={{ marginBottom: 0, display: "flex", alignItems: "center" }}>
                  {prize.label}
                  <InfoTip text={prize.description} />
                </h2>
                {live && <span className="pill alive">LIVE</span>}
              </div>

              {rows && rows.length > 0 ? (
                <div className="table-scroll"><table>
                  <tbody>
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={row.entry}>
                        <td>{i + 1}. <TruncateText text={row.entryName} maxWidth={150} href={row.gw ? `/team/${row.entry}?gw=${row.gw}` : `/team/${row.entry}`} /><RankArrow delta={row.delta} /></td>
                        <td style={{ textAlign: "right" }}>{row.display}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              ) : (
                <p className="muted">
                  {prize.key === "rankJumpMonth" && data?.rankJumpIsFirstMonth
                    ? "This will start from next month - this month's rankings will be the baseline to calculate the jump."
                    : "No data yet this season - check back once the relevant gameweeks have been played."}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
