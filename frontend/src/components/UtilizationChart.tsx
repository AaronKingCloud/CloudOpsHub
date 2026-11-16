import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../hooks/useApi";
import type { MetricPoint } from "../types/Dashboard";

interface UtilizationChartProps {
  title: string;
  seriesLabel: string;
  color: string;
  fetcher: () => Promise<MetricPoint[]>;
}

export default function UtilizationChart({
  title,
  seriesLabel,
  color,
  fetcher,
}: UtilizationChartProps) {
  const { data, loading, error } = useApi(fetcher);

  return (
    <section className="panel">
      <h2>{title}</h2>
      {loading && <p className="state-message">Loading metrics...</p>}
      {error && <p className="state-message">Could not load metrics: {error}</p>}
      {data && (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
            <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => [`${value}%`, seriesLabel]} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
