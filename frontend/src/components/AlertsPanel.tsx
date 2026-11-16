import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { getAlerts } from "../services/dashboardService";
import type { AlertSeverity } from "../types/Dashboard";
import { alertTone } from "../utils/status";
import { ErrorState, Skeleton } from "./PanelStatus";
import StatusBadge from "./StatusBadge";

const SEVERITY_ORDER: AlertSeverity[] = ["critical", "warning", "info"];

interface AlertsPanelProps {
  // Show severity filter buttons (used on the Alerts page).
  showFilter?: boolean;
}

// Answers "What needs my attention right now?" (docs/architecture/dashboard-design.md).
// Most severe alerts first.
function AlertsPanel({ showFilter = false }: AlertsPanelProps) {
  const { data: alerts, loading, error, reload } = useApi(getAlerts, { live: true });
  const [filter, setFilter] = useState<AlertSeverity | "all">("all");

  const sorted = alerts
    ? [...alerts].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
    : null;
  const visible = sorted?.filter((a) => filter === "all" || a.severity === filter) ?? null;
  const count = (s: AlertSeverity) => alerts?.filter((a) => a.severity === s).length ?? 0;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Attention Required</h2>
        {showFilter && alerts && (
          <div className="segmented" role="group" aria-label="Filter by severity">
            {(["all", ...SEVERITY_ORDER] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={filter === s ? "active" : ""}
                aria-pressed={filter === s}
                onClick={() => setFilter(s)}
              >
                {s === "all" ? `All (${alerts.length})` : `${s[0].toUpperCase()}${s.slice(1)} (${count(s)})`}
              </button>
            ))}
          </div>
        )}
      </div>
      {loading && <Skeleton rows={3} />}
      {error && <ErrorState what="alerts" message={error} onRetry={reload} />}
      {alerts?.length === 0 && <p className="state-message">All clear, no active alerts.</p>}
      {visible && alerts && alerts.length > 0 && visible.length === 0 && (
        <p className="state-message">No {filter} alerts.</p>
      )}
      {visible && visible.length > 0 && (
        <ul className="alert-list">
          {visible.map((alert) => (
            <li key={alert.id} className="alert-item">
              <StatusBadge label={alert.severity} tone={alertTone(alert.severity)} />
              <span>{alert.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default AlertsPanel;
