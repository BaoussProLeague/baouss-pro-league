export default function Dialog({ dialog, onClose }) {
  if (!dialog) return null;
  const { type, title, message } = dialog; // type: 'error' | 'warning' | 'success'

  const colors = {
    error: { border: "var(--danger)", label: "Error", icon: "✕" },
    warning: { border: "var(--accent-bright)", label: "Check this", icon: "!" },
    success: { border: "var(--success)", label: "Done", icon: "✓" },
  };
  const c = colors[type] || colors.error;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 420, width: "90%", borderColor: c.border, margin: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span
            style={{
              width: 24, height: 24, borderRadius: "50%", background: c.border,
              color: "#0d0716", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}
          >
            {c.icon}
          </span>
          <strong style={{ fontSize: 15 }}>{title || c.label}</strong>
        </div>
        <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, margin: "0 0 16px" }}>{message}</p>
        <button onClick={onClose} style={{ width: "100%" }}>Got it</button>
      </div>
    </div>
  );
}
