import type { DashboardSummary } from "../types/Dashboard";
import { alerts } from "./alerts";
import { devices } from "./devices";

// Derived from the other mocks so the numbers always agree.
export const summary: DashboardSummary = {
  onlineDevices: devices.filter((d) => d.status === "online").length,
  offlineDevices: devices.filter((d) => d.status === "offline").length,
  activeAlerts: alerts.length,
  totalDevices: devices.length,
};
