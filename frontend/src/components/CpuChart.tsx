import { useApi } from "../hooks/useApi";
import { getCpuMetrics } from "../services/dashboardService";
import MetricChart from "./MetricChart";
import { ErrorState, Skeleton } from "./PanelStatus";

function CpuChart() {
  const { data, loading, error, reload } = useApi(getCpuMetrics, { live: true });

  return (
    <section className="panel">
      <h2>CPU Utilization</h2>
      {loading && <Skeleton height={240} />}
      {error && <ErrorState what="metrics" message={error} onRetry={reload} />}
      {data && <MetricChart data={data} label="CPU" />}
    </section>
  );
}

export default CpuChart;
