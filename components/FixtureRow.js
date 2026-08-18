import { useState } from "react";

function TeamCrest({ team, size = 22 }) {
  const [failed, setFailed] = useState(false);
  if (!team.code || failed) {
    return (
      <span style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--muted)", flexShrink: 0 }}>
        {team.shortName}
      </span>
    );
  }
  return (
    <img
      src={`https://resources.premierleague.com/premierleague/badges/70/t${team.code}.png`}
      alt={team.shortName}
      width={size}
      height={size}
      style={{ objectFit: "contain", flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}

function StatLine({ label, home, away }) {
  if (home.length === 0 && away.length === 0) return null;
  return (
    <div style={{ display: "flex", fontSize: 11.5, padding: "4px 0", color: "var(--muted)" }}>
      <div style={{ flex: 1, textAlign: "right", paddingRight: 8 }}>{home.join(", ") || "—"}</div>
      <div style={{ flexShrink: 0, width: 60, textAlign: "center", color: "var(--muted-2)" }}>{label}</div>
      <div style={{ flex: 1, textAlign: "left", paddingLeft: 8 }}>{away.join(", ") || "—"}</div>
    </div>
  );
}

export default function FixtureRow({ fixture }) {
  const [expanded, setExpanded] = useState(false);
  const isLive = fixture.started && !fixture.finished;
  const kickoffLabel = new Date(fixture.kickoff).toLocaleString(undefined, {
    weekday: "short", hour: "2-digit", minute: "2-digit",
  });

  const hasStats = fixture.stats && (
    fixture.stats.homeScorers.length > 0 || fixture.stats.awayScorers.length > 0 ||
    fixture.stats.homeAssists.length > 0 || fixture.stats.awayAssists.length > 0 ||
    fixture.stats.homeOwnGoals.length > 0 || fixture.stats.awayOwnGoals.length > 0 ||
    fixture.stats.homeYellow.length > 0 || fixture.stats.awayYellow.length > 0 ||
    fixture.stats.homeRed.length > 0 || fixture.stats.awayRed.length > 0 ||
    fixture.stats.homeSaves.length > 0 || fixture.stats.awaySaves.length > 0 ||
    fixture.stats.homeBonus.length > 0 || fixture.stats.awayBonus.length > 0
  );

  const bonusLabel = (b) => b.map((x) => (x.points ? `${x.name} (+${x.points})` : x.name));

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        onClick={() => hasStats && setExpanded((e) => !e)}
        style={{ display: "flex", alignItems: "center", padding: "10px 0", fontSize: 13, gap: 8, cursor: hasStats ? "pointer" : "default" }}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fixture.home.shortName}</span>
          <TeamCrest team={fixture.home} />
        </div>

        <div style={{ flexShrink: 0, minWidth: 64, textAlign: "center" }}>
          {fixture.started ? (
            <span style={{ fontWeight: 700, color: isLive ? "var(--accent-bright)" : "var(--text)" }}>
              {fixture.homeScore} - {fixture.awayScore}
            </span>
          ) : (
            <span className="muted" style={{ fontSize: 11.5 }}>{kickoffLabel}</span>
          )}
          {isLive && (
            <div style={{ fontSize: 10, color: "var(--accent-bright)", fontWeight: 700, marginTop: 2 }}>
              ● LIVE {fixture.minutes}'
            </div>
          )}
          {fixture.finished && <div style={{ fontSize: 10, color: "var(--muted-2)", marginTop: 2 }}>FT</div>}
          {hasStats && <div style={{ fontSize: 9, color: "var(--muted-2)", marginTop: 2 }}>{expanded ? "▲" : "▼"} details</div>}
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <TeamCrest team={fixture.away} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fixture.away.shortName}</span>
        </div>
      </div>

      {expanded && hasStats && (
        <div style={{ paddingBottom: 10 }}>
          <StatLine label="⚽ Goals" home={fixture.stats.homeScorers} away={fixture.stats.awayScorers} />
          <StatLine label="🅰️ Assists" home={fixture.stats.homeAssists} away={fixture.stats.awayAssists} />
          <StatLine label="😬 Own goal" home={fixture.stats.homeOwnGoals} away={fixture.stats.awayOwnGoals} />
          <StatLine label="🧤 Saves" home={fixture.stats.homeSaves} away={fixture.stats.awaySaves} />
          <StatLine label="🟨 Yellow" home={fixture.stats.homeYellow} away={fixture.stats.awayYellow} />
          <StatLine label="🟥 Red" home={fixture.stats.homeRed} away={fixture.stats.awayRed} />
          <StatLine
            label={fixture.stats.bonusConfirmed ? "Bonus" : "Bonus (live)"}
            home={bonusLabel(fixture.stats.homeBonus)}
            away={bonusLabel(fixture.stats.awayBonus)}
          />
          {!fixture.stats.bonusConfirmed && (fixture.stats.homeBonus.length > 0 || fixture.stats.awayBonus.length > 0) && (
            <p style={{ fontSize: 10, color: "var(--muted-2)", textAlign: "center", margin: "4px 0 0" }}>
              Provisional - based on live BPS, not yet officially confirmed
            </p>
          )}
        </div>
      )}
    </div>
  );
}
