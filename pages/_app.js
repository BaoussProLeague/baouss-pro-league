import { useEffect } from "react";
import "../styles/globals.css";
import Nav from "../components/Nav";

export default function App({ Component, pageProps }) {
  // Trigger-on-visit automation: a quiet, fire-and-forget ping on every
  // page load. Cooldown-protected server-side (see /api/auto-check), so
  // this is cheap even with many simultaneous visitors - most calls just
  // find it's too soon and do nothing.
  useEffect(() => {
    fetch("/api/auto-check").catch(() => {});

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <>
      <Nav />
      <Component {...pageProps} />
    </>
  );
}
