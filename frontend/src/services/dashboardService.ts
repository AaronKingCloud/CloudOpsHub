// Every component gets its data through these functions, never from mock/ directly.
// Switching between mock data and the real backend only requires changing VITE_USE_MOCK.

import { accounts } from "../mock/accounts";
import { alerts } from "../mock/alerts";
import { cpuData } from "../mock/cpuData";
import { devices } from "../mock/devices";
import { summary } from "../mock/summary";
import type { Account } from "../types/Account";
import type { Alert, DashboardSummary, Device, MetricPoint } from "../types/Dashboard";
import { apiClient, USE_MOCK } from "./apiClient";

async function get<T>(path: string, mock: T): Promise<T> {
  if (USE_MOCK) {
    return mock;
  }
  const response = await apiClient.get<T>(path);
  return response.data;
}

export const getDashboardSummary = () => get<DashboardSummary>("/dashboard/summary", summary);
export const getDevices = () => get<Device[]>("/devices", devices);
export const getCpuMetrics = () => get<MetricPoint[]>("/metrics/cpu", cpuData);
export const getAlerts = () => get<Alert[]>("/alerts", alerts);
export const getAccounts = () => get<Account[]>("/accounts", accounts);
