// Team/manager names are unpredictable in length once 50+ real people
// join - relying on unlimited nowrap + horizontal scroll (the previous
// approach) breaks down at that scale, as the screenshot showed: long
// names got visually clipped and reappeared shifted into the next
// column instead of scrolling cleanly. A bounded max-width with ellipsis
// is the standard, predictable fix - the cell never grows unpredictably,
// and the full name is still available via native title-tooltip.
export default function TruncateText({ text, maxWidth = 170 }) {
  return (
    <span
      title={text}
      style={{
        display: "inline-block",
        maxWidth,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        verticalAlign: "bottom",
      }}
    >
      {text}
    </span>
  );
}
