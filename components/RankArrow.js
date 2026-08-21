export default function RankArrow({ delta }) {
  if (delta === "up") return <span style={{ color: "var(--success)", fontSize: 11, marginLeft: 4 }}>▲</span>;
  if (delta === "down") return <span style={{ color: "var(--danger)", fontSize: 11, marginLeft: 4 }}>▼</span>;
  return null;
}
