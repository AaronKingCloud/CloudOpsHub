import { useCallback, useEffect, useState, type ReactNode } from "react";
import { REFRESH_INTERVAL_MS, RefreshContext } from "./refreshContextDef";

const STORAGE_KEY = "cloudopshub_auto_refresh";

function readAutoRefresh(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

// Drives auto-refresh for data fetched with useApi(fetcher, { live: true }).
// Ticks every 30s while the tab is visible; catches up as soon as the tab is shown again.
export function RefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date());
  const [autoRefresh, setAutoRefreshState] = useState(readAutoRefresh);

  const refreshNow = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setLastRefreshed(new Date());
  }, []);

  const setAutoRefresh = useCallback((on: boolean) => {
    setAutoRefreshState(on);
    try {
      localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
    } catch {
      // Not remembered in private mode; still works for this visit.
    }
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const tick = () => {
      if (document.visibilityState === "visible") refreshNow();
    };
    const interval = window.setInterval(tick, REFRESH_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefreshed.getTime() > REFRESH_INTERVAL_MS) {
        refreshNow();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [autoRefresh, lastRefreshed, refreshNow]);

  return (
    <RefreshContext.Provider value={{ refreshKey, lastRefreshed, autoRefresh, setAutoRefresh, refreshNow }}>
      {children}
    </RefreshContext.Provider>
  );
}
