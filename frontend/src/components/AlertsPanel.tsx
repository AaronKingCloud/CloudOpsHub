import { useApi } from "../hooks/useApi";
import { getAlerts } from "../services/dashboardService";
import { alertTone } from "../utils/status";
import StatusBadge from "./StatusBadge";

// Answers "What needs my attention right now?" (docs/architecture/dashboard-design.md)
function AlertsPanel() {
  const { data: alerts, loading, error } = useApi(getAlerts);

  return (
    <section className="panel">
      <h2>Attention Required</h2>
      {loading && <p className="state-message">Loading alerts...</p>}
      {error && <p className="state-message">Could not load alerts: {error}</p>}
      {alerts?.length === 0 && <p className="state-message">All clear, no active alerts.</p>}
      {alerts && alerts.length > 0 && (
        <ul className="alert-list">
          {alerts.map((alert) => (
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
