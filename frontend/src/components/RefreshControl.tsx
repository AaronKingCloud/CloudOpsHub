import { useContext } from "react";
import { REFRESH_INTERVAL_MS, RefreshContext } from "../context/refreshContextDef";
import Icon from "./layout/Icon";

// "Updated 23:41:05 · [x] Auto-refresh 30s · [↻]" — shown on pages with live data.
function RefreshControl() {
  const { lastRefreshed, autoRefresh, setAutoRefresh, refreshNow } = useContext(RefreshContext);

  return (
    <div className="refresh-control">
      <span className="refresh-time">Updated {lastRefreshed.toLocaleTimeString()}</span>
      <label className="toggle">
        <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
        <span>Auto-refresh {REFRESH_INTERVAL_MS / 1000}s</span>
      </label>
      <button type="button" className="icon-btn" onClick={refreshNow} title="Refresh now" aria-label="Refresh now">
        <Icon name="refresh" size={16} />
      </button>
    </div>
  );
}

export default RefreshControl;
