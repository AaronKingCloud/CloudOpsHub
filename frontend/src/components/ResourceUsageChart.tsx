import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../hooks/useApi";
import { getDevices } from "../services/dashboardService";
import { ErrorState, Skeleton } from "./PanelStatus";

// Memory and storage per device (current values) — the "Memory / Storage Utilization" charts
// from docs/architecture/dashboard-design.md. The backend has no history for these yet, so this
// compares devices rather than showing a time series.
// Series colours are CSS variables (--series-1/2 in styles/widgets.css) so they follow the theme;
// they were checked for colour-blind separation and contrast in both light and dark mode.

const SERIES = [
  { key: "memory", label: "Memory", className: "series-1" },
  { key: "storage", label: "Storage", className: "series-2" },
] as const;

const CRITICAL = 90;

interface Row {
  hostname: string;
  online: boolean;
  memory: number | null; // null when offline: 0% would read as "healthy"
  storage: number;
}

function ResourceUsageChart() {
  const { data: devices, loading, error, reload } = useApi(getDevices, { live: true });

  const rows: Row[] | null =
    devices?.map((d) => ({
      hostname: d.hostname,
      online: d.status === "online",
      memory: d.status === "online" ? d.memory : null,
      storage: d.storage,
    })) ?? null;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Memory &amp; Storage by Device</h2>
        <ul className="chart-legend" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key}>
              <span className={`legend-swatch ${s.className}`} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
      {loading && <Skeleton height={260} />}
      {error && <ErrorState what="devices" message={error} onRetry={reload} />}
      {rows && (
        <div className="resource-chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2} barCategoryGap="24%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
              <XAxis dataKey="hostname" tick={{ fontSize: 12 }} interval={0} tickLine={false} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={{ fontSize: 12 }} />
              <ReferenceLine
                y={CRITICAL}
                stroke="currentColor"
                strokeOpacity={0.45}
                strokeDasharray="4 4"
                label={{ value: `${CRITICAL}% critical`, position: "insideTopRight", fontSize: 11, fill: "currentColor" }}
              />
              <Tooltip
                cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as Row;
                  return (
                    <div className="chart-tooltip">
                      <strong>{label}</strong>
                      {!row.online && <span className="tooltip-note">Offline</span>}
                      {SERIES.map((s) => (
                        <div key={s.key} className="tooltip-row">
                          <span className={`legend-swatch ${s.className}`} aria-hidden="true" />
                          {s.label}
                          <span className="tooltip-value">{row[s.key] === null ? "no data" : `${row[s.key]}%`}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {SERIES.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  className={s.className}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export default ResourceUsageChart;
