import { useCallback, useState } from "react";
import { Link } from "react-router";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { acknowledgeAlert, listAlerts, resolveAlert, type AlertScope } from "../services/alertService";
import type { Alert, AlertSeverity } from "../types/Dashboard";
import { getErrorMessage } from "../utils/errors";
import { alertTone } from "../utils/status";
import { timeAgo } from "../utils/time";
import { ErrorState, Skeleton } from "./PanelStatus";
import StatusBadge from "./StatusBadge";

const SEVERITY_ORDER: AlertSeverity[] = ["critical", "warning", "info"];

interface AlertsPanelProps {
  // Alerts page: severity + history filters and acknowledge / resolve buttons.
  showFilter?: boolean;
}

// Answers "What needs my attention right now?" (docs/architecture/dashboard-design.md).
// Most severe first; within a severity, unacknowledged before acknowledged.
function AlertsPanel({ showFilter = false }: AlertsPanelProps) {
  const { can } = useAuth();
  const [scope, setScope] = useState<AlertScope>("active");
  const fetchAlerts = useCallback(() => listAlerts(scope), [scope]);
  const { data: alerts, loading, error, reload } = useApi(fetchAlerts, { live: true });
  const [filter, setFilter] = useState<AlertSeverity | "all">("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rank = (a: Alert) =>
    SEVERITY_ORDER.indexOf(a.severity) * 10 + ({ open: 0, acknowledged: 1, resolved: 2 }[a.status ?? "open"] ?? 0);
  const sorted = alerts ? [...alerts].sort((a, b) => rank(a) - rank(b)) : null;
  const visible = sorted?.filter((a) => filter === "all" || a.severity === filter) ?? null;
  const count = (s: AlertSeverity) => alerts?.filter((a) => a.severity === s).length ?? 0;
  const canAct = showFilter && can("handleAlerts");

  const act = async (alert: Alert, action: "acknowledge" | "resolve") => {
    setBusyId(alert.id);
    setActionError(null);
    try {
      await (action === "acknowledge" ? acknowledgeAlert(alert.id) : resolveAlert(alert.id));
      reload();
    } catch (err) {
      setActionError(`Couldn't ${action} "${alert.message}": ${getErrorMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Attention Required</h2>
        {showFilter && alerts && (
          <div className="alert-filters">
            <div className="segmented" role="group" aria-label="Show">
              {(["active", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={scope === s ? "active" : ""}
                  aria-pressed={scope === s}
                  onClick={() => setScope(s)}
                >
                  {s === "active" ? "Active" : "Including resolved"}
                </button>
              ))}
            </div>
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
          </div>
        )}
      </div>
      {actionError && (
        <div className="notice warn" role="alert">
          <p className="notice-title">{actionError}</p>
        </div>
      )}
      {loading && <Skeleton rows={3} />}
      {error && <ErrorState what="alerts" message={error} onRetry={reload} />}
      {alerts?.length === 0 && (
        <p className="state-message">{scope === "active" ? "All clear, no active alerts." : "No alerts yet."}</p>
      )}
      {visible && alerts && alerts.length > 0 && visible.length === 0 && (
        <p className="state-message">No {filter} alerts.</p>
      )}
      {visible && visible.length > 0 && (
        <ul className="alert-list">
          {visible.map((alert) => {
            const status = alert.status ?? "open";
            return (
              <li key={alert.id} className={`alert-item status-${status}`}>
                <StatusBadge label={alert.severity} tone={alertTone(alert.severity)} />
                <span className="alert-text">
                  {alert.deviceId ? <Link to={`/devices/${alert.deviceId}`}>{alert.message}</Link> : alert.message}
                  {showFilter && (
                    <span className="alert-meta">
                      {status === "acknowledged"
                        ? `Acknowledged${alert.acknowledgedBy ? ` by ${alert.acknowledgedBy}` : ""}`
                        : status === "resolved"
                          ? `Resolved${alert.resolvedAt ? ` ${timeAgo(alert.resolvedAt)}` : ""}`
                          : "Open"}
                      {alert.createdAt ? ` · started ${timeAgo(alert.createdAt)}` : ""}
                    </span>
                  )}
                </span>
                {canAct && status !== "resolved" && (
                  <span className="alert-actions">
                    {status === "open" && (
                      <button
                        type="button"
                        className="btn small"
                        disabled={busyId === alert.id}
                        onClick={() => act(alert, "acknowledge")}
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn small"
                      disabled={busyId === alert.id}
                      onClick={() => act(alert, "resolve")}
                    >
                      Resolve
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default AlertsPanel;
