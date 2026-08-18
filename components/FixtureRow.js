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

export default function FixtureRow({ fixture }) {
  const isLive = fixture.started && !fixture.finished;
  const kickoffLabel = new Date(fixture.kickoff).toLocaleString(undefined, {
    weekday: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 13, gap: 8 }}>
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
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <TeamCrest team={fixture.away} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fixture.away.shortName}</span>
      </div>
    </div>
  );
}
