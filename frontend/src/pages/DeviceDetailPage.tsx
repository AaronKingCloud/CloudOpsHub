import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import AgentSetupPanel from "../components/devices/AgentSetupPanel";
import DeleteDeviceDialog from "../components/devices/DeleteDeviceDialog";
import DeviceFormDialog from "../components/devices/DeviceFormDialog";
import PageHeader from "../components/layout/PageHeader";
import MetricChart from "../components/MetricChart";
import { ErrorState, Skeleton } from "../components/PanelStatus";
import RefreshControl from "../components/RefreshControl";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { listAlerts } from "../services/alertService";
import { getDevice, getDeviceMetrics } from "../services/deviceService";
import type { Device, DeviceMetric } from "../types/Dashboard";
import { DEVICE_TYPES } from "../utils/deviceTypes";
import { alertTone, deviceTone, usageTone } from "../utils/status";
import { timeAgo } from "../utils/time";
import "../styles/devices.css";

const METRICS: { key: DeviceMetric; label: string; color: string }[] = [
  { key: "cpu", label: "CPU", color: "#6366f1" },
  { key: "memory", label: "Memory", color: "#0ea5e9" },
  { key: "storage", label: "Storage", color: "#f59e0b" },
];
const RANGES = [
  { hours: 1, label: "1h" },
  { hours: 6, label: "6h" },
  { hours: 24, label: "24h" },
  { hours: 168, label: "7d" },
];

interface LocationState {
  agentKey?: string;
}

function DeviceDetailPage() {
  const id = Number(useParams().id);
  const location = useLocation();
  const navigate = useNavigate();

  // A just-created device arrives with its agent key. Keep it in memory only, and drop it from the
  // browser history so a reload doesn't show it again.
  const [agentKey] = useState(() => (location.state as LocationState | null)?.agentKey);
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const fetchDevice = useCallback(() => getDevice(id), [id]);
  const { data: device, loading, error, errorStatus, reload } = useApi(fetchDevice, { live: true });

  if (loading) {
    return (
      <>
        <PageHeader description="Loading device…" />
        <section className="panel">
          <Skeleton rows={4} />
        </section>
      </>
    );
  }
  if (error || !device) {
    const missing = errorStatus === 404 || /doesn't exist/.test(error ?? "");
    return (
      <section className="panel empty-page">
        <h2>{missing ? "Device not found" : "Couldn't load this device"}</h2>
        {missing ? (
          <p className="state-message">It may have been deleted.</p>
        ) : (
          <ErrorState what="the device" message={error ?? ""} onRetry={reload} />
        )}
        <Link to="/devices" className="btn">
          Back to Devices
        </Link>
      </section>
    );
  }

  return <DeviceDetail device={device} agentKey={agentKey} onChanged={reload} />;
}

interface DeviceDetailProps {
  device: Device;
  agentKey?: string;
  onChanged: () => void;
}

function DeviceDetail({ device, agentKey, onChanged }: DeviceDetailProps) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <PageHeader
        description={device.description || "No description"}
        actions={
          <>
            <RefreshControl />
            {can("manageDevices") && (
              <>
                <button type="button" className="btn" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button type="button" className="btn danger-outline" onClick={() => setDeleting(true)}>
                  Delete
                </button>
              </>
            )}
          </>
        }
      />

      <section className="panel device-hero" aria-labelledby="device-name">
        <div className="device-title">
          <Link to="/devices" className="back-link">
            ← Devices
          </Link>
          <h2 id="device-name">{device.hostname}</h2>
          <StatusBadge label={device.status} tone={deviceTone(device.status)} />
        </div>
        <dl className="kv-grid">
          <div>
            <dt>Type</dt>
            <dd>{device.type ? DEVICE_TYPES[device.type] : "Not set"}</dd>
          </div>
          <div>
            <dt>IP address</dt>
            <dd className="mono">{device.ipAddress || "Not set"}</dd>
          </div>
          <div>
            <dt>Last report</dt>
            <dd title={device.lastSeen ? new Date(device.lastSeen).toLocaleString() : undefined}>
              {device.lastSeen ? timeAgo(device.lastSeen) : "Never"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="stat-cards" aria-label="Current usage">
        {METRICS.map((m) => (
          <StatCard
            key={m.key}
            label={`${m.label} now`}
            value={device.status === "online" || m.key === "storage" ? `${device[m.key]}%` : "—"}
            tone={device.status === "online" || m.key === "storage" ? usageTone(device[m.key]) : undefined}
          />
        ))}
      </section>

      <DeviceHistory device={device} />
      <DeviceAlerts deviceId={device.id} />
      <AgentSetupPanel device={device} agentKey={agentKey} />

      {editing && (
        <DeviceFormDialog
          device={device}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
      {deleting && (
        <DeleteDeviceDialog
          device={device}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate("/devices", { state: { deleted: device.hostname } })}
        />
      )}
    </>
  );
}

function DeviceHistory({ device }: { device: Device }) {
  const [metric, setMetric] = useState<DeviceMetric>("cpu");
  const [hours, setHours] = useState(24);
  const fetchHistory = useCallback(() => getDeviceMetrics(device.id, metric, hours), [device.id, metric, hours]);
  const { data, loading, error, errorStatus, reload } = useApi(fetchHistory, { live: true });
  const current = METRICS.find((m) => m.key === metric)!;

  return (
    <section className="panel" aria-labelledby="history-title">
      <div className="panel-header">
        <h2 id="history-title">History</h2>
        <div className="history-controls">
          <div className="segmented" role="group" aria-label="Metric">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={metric === m.key ? "active" : ""}
                aria-pressed={metric === m.key}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.hours}
                type="button"
                className={hours === r.hours ? "active" : ""}
                aria-pressed={hours === r.hours}
                onClick={() => setHours(r.hours)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {loading && <Skeleton height={240} />}
      {error &&
        (errorStatus === 404 ? (
          <p className="state-message">History isn't available from the backend yet (device metrics API, task B2).</p>
        ) : (
          <ErrorState what="history" message={error} onRetry={reload} />
        ))}
      {data && data.length === 0 && <p className="state-message">No reports in this period.</p>}
      {data && data.length > 0 && <MetricChart data={data} label={current.label} color={current.color} />}
    </section>
  );
}

function DeviceAlerts({ deviceId }: { deviceId: number }) {
  const fetchAlerts = useCallback(() => listAlerts("all"), []);
  const { data: alerts, loading, error, reload } = useApi(fetchAlerts, { live: true });
  const mine = alerts?.filter((a) => a.deviceId === deviceId) ?? null;

  return (
    <section className="panel" aria-labelledby="device-alerts-title">
      <div className="panel-header">
        <h2 id="device-alerts-title">Alerts for this device</h2>
        <Link to="/alerts" className="panel-subtitle">
          All alerts →
        </Link>
      </div>
      {loading && <Skeleton rows={2} />}
      {error && <ErrorState what="alerts" message={error} onRetry={reload} />}
      {mine?.length === 0 && <p className="state-message">No alerts for this device.</p>}
      {mine && mine.length > 0 && (
        <ul className="alert-list">
          {mine.map((a) => (
            <li key={a.id} className="alert-item">
              <StatusBadge label={a.severity} tone={alertTone(a.severity)} />
              <span>{a.message}</span>
              <span className="alert-meta">
                {a.status ?? "open"}
                {a.createdAt ? ` · ${timeAgo(a.createdAt)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default DeviceDetailPage;
