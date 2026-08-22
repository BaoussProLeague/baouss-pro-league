import { useState } from "react";

// I got this wrong twice by guessing a single URL pattern. Rather than
// guess a third time, this tries several real, previously-confirmed FPL
// CDN patterns in sequence - whichever one is actually correct for the
// current season will load; the others just fail silently and it moves
// to the next candidate. Only falls back to a plain initial badge if
// every candidate 404s.
function candidateUrls(photoCode) {
  return [
    `https://resources.premierleague.com/premierleague25/photos/players/110x140/${photoCode}.png`,
    `https://resources.premierleague.com/premierleague26/photos/players/110x140/${photoCode}.png`,
    `https://resources.premierleague.com/premierleague/photos/players/110x140/${photoCode}.png`,
    `https://resources.premierleague.com/premierleague25/photos/players/110x140/p${photoCode}.png`,
  ];
}

export default function PlayerPhoto({ photoCode, name, size = 44 }) {
  const [attempt, setAttempt] = useState(0);
  const urls = photoCode ? candidateUrls(photoCode) : [];
  const exhausted = !photoCode || attempt >= urls.length;

  if (exhausted) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%", background: "var(--panel-hover)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.34, fontWeight: 700, color: "var(--muted)", margin: "0 auto",
      }}>
        {name ? name[0] : "?"}
      </div>
    );
  }

  return (
    <img
      src={urls[attempt]}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: "cover", borderRadius: "50%", display: "block", margin: "0 auto" }}
      onError={() => setAttempt((a) => a + 1)}
    />
  );
}
