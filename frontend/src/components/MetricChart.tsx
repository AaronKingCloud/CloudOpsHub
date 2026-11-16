import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricPoint } from "../types/Dashboard";

interface MetricChartProps {
  data: MetricPoint[];
  label: string; // shown in the tooltip, e.g. "CPU"
  color?: string;
  height?: number;
}

// Percentage-over-time area chart (0–100%). Used by CpuChart and the EC2 CPU panel.
function MetricChart({ data, label, color = "#6366f1", height = 240 }: MetricChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
        <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} minTickGap={24} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${value}%`, label]} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.15}
          strokeWidth={2}
          // The reveal animation can get stuck at zero width (e.g. under React StrictMode),
          // leaving the chart blank. A monitoring chart should just show the data.
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default MetricChart;
