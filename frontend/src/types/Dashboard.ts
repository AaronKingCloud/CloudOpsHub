// Types that mirror the API contract in docs/api/frontend-contract.md.
// If you change a shape here, update the contract and the backend schemas too.

export interface DashboardSummary {
  onlineDevices: number;
  offlineDevices: number;
  activeAlerts: number;
  totalDevices: number;
}

export type DeviceStatus = "online" | "offline";

export interface Device {
  id: number;
  hostname: string;
  status: DeviceStatus;
  cpu: number;
  memory: number;
  storage: number;
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: number;
  severity: AlertSeverity;
  message: string;
}
