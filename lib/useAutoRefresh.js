import { useEffect, useRef } from "react";

// Every "live" page uses this the same way: call load() once on mount,
// then again automatically every `intervalMs` while the tab is open and
// visible. Pauses when the tab isn't visible so it's not burning FPL API
// calls (and your Supabase/Vercel usage) in a background tab nobody's
// looking at.
export function useAutoRefresh(load, intervalMs = 60000) {
  const savedLoad = useRef(load);
  savedLoad.current = load;

  useEffect(() => {
    savedLoad.current();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        savedLoad.current();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);
}
