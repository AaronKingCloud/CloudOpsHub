import { useApi } from "../hooks/useApi";
import { getCpuMetrics } from "../services/dashboardService";
import MetricChart from "./MetricChart";

function CpuChart() {
  const { data, loading, error } = useApi(getCpuMetrics);

  return (
    <section className="panel">
      <h2>CPU Utilization</h2>
      {loading && <p className="state-message">Loading metrics...</p>}
      {error && <p className="state-message">Could not load metrics: {error}</p>}
      {data && <MetricChart data={data} label="CPU" />}
    </section>
  );
}

export default CpuChart;
