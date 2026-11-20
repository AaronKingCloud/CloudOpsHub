// Types that mirror the API contract in docs/api/frontend-contract.md.
// If you change a shape here, update the contract and the backend schemas too.

export interface DashboardSummary {
  onlineDevices: number;
  offlineDevices: number;
  activeAlerts: number;
  totalDevices: number;
}

export type DeviceStatus = "online" | "offline";

// What kind of thing is being monitored (asset management, see README "Planned Capabilities").
export type DeviceType = "server" | "vm" | "container" | "nas" | "service";

export interface Device {
  id: number;
  hostname: string;
  status: DeviceStatus;
  cpu: number;
  memory: number;
  storage: number;
  // Optional until the device API (REMAINING_WORK B2) returns them; the UI copes without.
  type?: DeviceType;
  ipAddress?: string | null;
  description?: string | null;
  lastSeen?: string | null; // ISO time of the agent's last report
}

// Body of POST /devices and PUT /devices/{id}.
export interface DeviceInput {
  hostname: string;
  type: DeviceType;
  ipAddress?: string | null;
  description?: string | null;
}

// POST /devices and POST /devices/{id}/agent-key return the agent key once; it can't be read back later.
export interface AgentKeyResponse {
  agentKey: string;
}

export type DeviceMetric = "cpu" | "memory" | "storage";

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export type AlertSeverity = "info" | "warning" | "critical";

// open → acknowledged (someone is on it) → resolved. A missing status means open.
export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface Alert {
  id: number;
  severity: AlertSeverity;
  message: string;
  // Optional until the alert engine (REMAINING_WORK B4) returns them.
  deviceId?: number | null;
  status?: AlertStatus;
  createdAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
}
