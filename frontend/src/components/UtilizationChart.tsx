import { useApi } from "../hooks/useApi";
import type { MetricPoint } from "../types/Dashboard";
import MetricChart from "./MetricChart";
import { ErrorState, Skeleton } from "./PanelStatus";

interface UtilizationChartProps {
  title: string;
  seriesLabel: string;
  color: string;
  fetcher: () => Promise<MetricPoint[]>;
}

// Uses the shared MetricChart (animation off), otherwise the chart can render blank.
export default function UtilizationChart({ title, seriesLabel, color, fetcher }: UtilizationChartProps) {
  const { data, loading, error, reload } = useApi(fetcher, { live: true });

  return (
    <section className="panel">
      <h2>{title}</h2>
      {loading && <Skeleton height={220} />}
      {error && <ErrorState what="metrics" message={error} onRetry={reload} />}
      {data && <MetricChart data={data} label={seriesLabel} color={color} height={220} />}
    </section>
  );
}
