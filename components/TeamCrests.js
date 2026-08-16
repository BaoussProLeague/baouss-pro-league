import { useState } from "react";

function Crest({ team }) {
  const [failed, setFailed] = useState(false);
  const src = `https://resources.premierleague.com/premierleague/badges/70/t${team.code}.png`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 76 }}>
      {!failed ? (
        <img
          src={src}
          alt={`${team.name} crest`}
          width={40}
          height={40}
          onError={() => setFailed(true)}
          style={{ objectFit: "contain" }}
        />
      ) : (
        <div
          style={{
            width: 40, height: 40, borderRadius: "50%", background: "var(--panel-hover)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "var(--muted)",
          }}
        >
          {team.short_name}
        </div>
      )}
      <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>{team.short_name}</span>
    </div>
  );
}

// Crests are loaded directly from the Premier League's own CDN, not
// redrawn or stored by this app - each club's badge is their trademark,
// this just references the official image the same way the FPL site does.
export default function TeamCrests({ teams }) {
  if (!teams || teams.length === 0) return null;
  return (
    <div className="card">
      <h2>This season's clubs</h2>
      <div className="team-crest-grid">
        {teams.map((t) => (
          <Crest key={t.id} team={t} />
        ))}
      </div>
    </div>
  );
}
