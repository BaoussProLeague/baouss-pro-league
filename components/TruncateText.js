import Link from "next/link";

// Team/manager names are unpredictable in length once 50+ real people
// join - relying on unlimited nowrap + horizontal scroll (the previous
// approach) breaks down at that scale, as the screenshot showed: long
// names got visually clipped and reappeared shifted into the next
// column instead of scrolling cleanly. A bounded max-width with ellipsis
// is the standard, predictable fix - the cell never grows unpredictably,
// and the full name is still available via native title-tooltip.
//
// `href` is optional and purely additive - every existing call site that
// doesn't pass it renders exactly as before, unchanged. Only call sites
// that explicitly opt in by passing an entry ID become clickable links
// to that manager's team view.
export default function TruncateText({ text, maxWidth = 170, href }) {
  const style = {
    display: "inline-block",
    maxWidth,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    verticalAlign: "bottom",
  };

  if (href) {
    return (
      <Link href={href} title={text} style={{ ...style, color: "var(--text)", textDecoration: "underline", textDecorationColor: "var(--border-strong)", textUnderlineOffset: 2 }}>
        {text}
      </Link>
    );
  }

  return (
    <span title={text} style={style}>
      {text}
    </span>
  );
}
