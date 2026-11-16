import { createContext } from "react";

export interface RefreshContextType {
  // Increments on every auto-refresh tick and every "Refresh now" click.
  refreshKey: number;
  lastRefreshed: Date;
  autoRefresh: boolean;
  setAutoRefresh: (on: boolean) => void;
  refreshNow: () => void;
}

export const REFRESH_INTERVAL_MS = 30_000;

// Default (outside RefreshProvider): never refreshes.
export const RefreshContext = createContext<RefreshContextType>({
  refreshKey: 0,
  lastRefreshed: new Date(),
  autoRefresh: false,
  setAutoRefresh: () => {},
  refreshNow: () => {},
});
