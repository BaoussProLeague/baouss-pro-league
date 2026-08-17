import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

const links = [
  { href: "/", label: "Classic" },
  { href: "/h2h", label: "H2H Cups" },
  { href: "/lms", label: "LMS" },
  { href: "/prizes", label: "Prizes" },
  { href: "/rules", label: "Set Rules" },
  { href: "/admin", label: "Admin" },
];

// Drop your own logo file at /public/logo.png and it swaps in
// automatically here, with the lightning bolt as a fallback if the file
// isn't there yet - no code changes needed when you're ready to add it.
// See the exact prep spec in the chat message this shipped with -
// square canvas, transparent background, subject filling most of the frame.
function Crest() {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="crest fallback">⚡</span>;
  return (
    <span className="crest">
      <img src="/logo.png" alt="Baouss Pro League" onError={() => setFailed(true)} />
    </span>
  );
}

export default function Nav() {
  const router = useRouter();
  return (
    <div className="nav">
      <span className="brand">
        <Crest />
        Baouss<span className="gold">ProLeague</span>
      </span>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={router.pathname === l.href ? "active" : ""}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
