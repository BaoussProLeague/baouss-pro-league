import Link from "next/link";
import { useRouter } from "next/router";

const links = [
  { href: "/", label: "Classic" },
  { href: "/h2h", label: "H2H Cups" },
  { href: "/lms", label: "LMS" },
  { href: "/prizes", label: "Prizes" },
  { href: "/rules", label: "Set Rules" },
  { href: "/admin", label: "Admin" },
];

export default function Nav() {
  const router = useRouter();
  return (
    <div className="nav">
      <span className="brand">
        <span className="crest">⚡</span>
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
