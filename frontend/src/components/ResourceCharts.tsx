import { getMemoryMetrics, getStorageMetrics } from "../services/dashboardService";
import UtilizationChart from "./UtilizationChart";

export default function ResourceCharts() {
  return (
    <div className="grid-equal-2">
      <UtilizationChart
        title="Memory Utilization"
        seriesLabel="Memory"
        color="#0ea5e9"
        fetcher={getMemoryMetrics}
      />
      <UtilizationChart
        title="Storage Utilization"
        seriesLabel="Storage"
        color="#f59e0b"
        fetcher={getStorageMetrics}
      />
    </div>
  );
}
