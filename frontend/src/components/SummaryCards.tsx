import { useApi } from "../hooks/useApi";
import { getDashboardSummary } from "../services/dashboardService";
import StatCard from "./StatCard";

function SummaryCards() {
  const { data: summary, loading, error } = useApi(getDashboardSummary);

  if (loading) return <p className="state-message">Loading summary...</p>;
  if (error || !summary) return <p className="state-message">Could not load summary: {error}</p>;

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
