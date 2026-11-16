import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { useSort } from "../hooks/useSort";
import { getDevices } from "../services/dashboardService";
import type { Device, DeviceStatus } from "../types/Dashboard";
import { deviceTone, usageTone } from "../utils/status";
import { ErrorState, Skeleton } from "./PanelStatus";
import SortableTh from "./SortableTh";
import StatusBadge from "./StatusBadge";

type DeviceColumn = "hostname" | "status" | "cpu" | "memory" | "storage";

const COLUMNS: { key: DeviceColumn; label: string }[] = [
  { key: "hostname", label: "Hostname" },
  { key: "status", label: "Status" },
  { key: "cpu", label: "CPU" },
  { key: "memory", label: "Memory" },
  { key: "storage", label: "Storage" },
];

const getValue = (d: Device, key: DeviceColumn) => d[key];

function UsageBar({ percent }: { percent: number }) {
  return (
    <div className="usage">
      <div className="usage-track">
        <div className={`usage-fill ${usageTone(percent)}`} style={{ width: `${percent}%` }} />
      </div>
      {percent}%
    </div>
  );
}

interface DeviceTableProps {
  // Show search and status filter (used on the Devices page).
  showControls?: boolean;
}

function DeviceTable({ showControls = false }: DeviceTableProps) {
  const { data: devices, loading, error, reload } = useApi(getDevices, { live: true });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DeviceStatus | "all">("all");

  const filtered =
    devices?.filter(
      (d) => (status === "all" || d.status === status) && d.hostname.toLowerCase().includes(query.trim().toLowerCase()),
    ) ?? null;
  const { sorted, sort, toggle } = useSort(filtered, getValue, { key: "hostname", dir: "asc" });

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Device Status</h2>
        {showControls && devices && (
          <div className="table-controls">
            <input
              type="search"
              className="search-input"
              placeholder="Search hostname…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search devices by hostname"
            />
            <div className="segmented" role="group" aria-label="Filter by status">
              {(["all", "online", "offline"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={status === s ? "active" : ""}
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                >
                  {s === "all" ? "All" : s === "online" ? "Online" : "Offline"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {loading && <Skeleton rows={5} />}
      {error && <ErrorState what="devices" message={error} onRetry={reload} />}
      {sorted && sorted.length === 0 && <p className="state-message">No devices match your filters.</p>}
      {sorted && sorted.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <SortableTh
                    key={c.key}
                    label={c.label}
                    active={sort.key === c.key}
                    dir={sort.dir}
                    onClick={() => toggle(c.key, sorted[0] ? getValue(sorted[0], c.key) : undefined)}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((device) => (
                <tr key={device.id}>
                  <td>{device.hostname}</td>
                  <td>
                    <StatusBadge label={device.status} tone={deviceTone(device.status)} />
                  </td>
                  <td><UsageBar percent={device.cpu} /></td>
                  <td><UsageBar percent={device.memory} /></td>
                  <td><UsageBar percent={device.storage} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default DeviceTable;
