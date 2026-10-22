import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../hooks/useApi";
import { getCpuMetrics } from "../services/dashboardService";

const LINE_COLOR = "#6366f1";

function CpuChart() {
  const { data, loading, error } = useApi(getCpuMetrics);

  return (
    <section className="panel">
      <h2>CPU Utilization</h2>
      {loading && <p className="state-message">Loading metrics...</p>}
      {error && <p className="state-message">Could not load metrics: {error}</p>}
      {data && (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
            <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => [`${value}%`, "CPU"]} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={LINE_COLOR}
              fill={LINE_COLOR}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export default CpuChart;
