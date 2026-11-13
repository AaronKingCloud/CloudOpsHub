import { useApi } from "../hooks/useApi";
import { getDashboardSummary } from "../services/dashboardService";
import { ErrorState } from "./PanelStatus";
import StatCard from "./StatCard";

function SummaryCards() {
  const { data: summary, loading, error, reload } = useApi(getDashboardSummary, { live: true });

  if (loading) {
    return (
      <section className="stat-cards" aria-label="Loading summary">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="stat-card skeleton-card">
            <div className="skeleton skeleton-row short" />
            <div className="skeleton skeleton-row tall" />
          </div>
        ))}
      </section>
    );
  }
  if (error || !summary) {
    return (
      <section className="panel">
        <ErrorState what="summary" message={error ?? ""} onRetry={reload} />
      </section>
    );
  }

  return (
    <section className="stat-cards">
      <StatCard label="Online Devices" value={summary.onlineDevices} tone="ok" />
      <StatCard
        label="Offline Devices"
        value={summary.offlineDevices}
        tone={summary.offlineDevices > 0 ? "crit" : "ok"}
      />
      <StatCard
        label="Active Alerts"
        value={summary.activeAlerts}
        tone={summary.activeAlerts > 0 ? "warn" : "ok"}
      />
      <StatCard label="Total Devices" value={summary.totalDevices} />
    </section>
  );
}

export default SummaryCards;
