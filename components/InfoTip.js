import { useState } from "react";

export default function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-block", marginLeft: 6 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 16, height: 16, borderRadius: "50%", border: "1px solid var(--muted-2)",
          color: "var(--muted-2)", fontSize: 10, fontWeight: 700, cursor: "pointer",
        }}
      >
        ?
      </span>
      {open && (
        <span
          style={{
            position: "absolute", bottom: "130%", left: "50%", transform: "translateX(-50%)",
            background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
            borderRadius: 10, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5,
            color: "var(--text)", width: 240, zIndex: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            fontWeight: 400, textTransform: "none", letterSpacing: "normal",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
