// Every component gets its data through these functions, never from mock/ directly.
// Switching between mock data and the real backend only requires changing VITE_USE_MOCK.

import { accounts } from "../mock/accounts";
import { billingSummary } from "../mock/billing";
import { cpuData } from "../mock/cpuData";
import { memoryData } from "../mock/memoryData";
import { storageData } from "../mock/storageData";
import type { Account } from "../types/Account";
import type { BillingSummary } from "../types/Billing";
import type { Alert, DashboardSummary, Device, MetricPoint } from "../types/Dashboard";
import { listAlerts } from "./alertService";
import { apiClient, USE_MOCK } from "./apiClient";
import { listDevices } from "./deviceService";

async function get<T>(path: string, mock: T): Promise<T> {
  if (USE_MOCK) {
    return mock;
  }
  const response = await apiClient.get<T>(path);
  return response.data;
}

// In mock mode the summary is counted from the mock devices and alerts, so adding a device updates it.
export async function getDashboardSummary(): Promise<DashboardSummary> {
  if (!USE_MOCK) return (await apiClient.get<DashboardSummary>("/dashboard/summary")).data;
  const [devices, alerts] = await Promise.all([listDevices(), listAlerts("active")]);
  const online = devices.filter((d) => d.status === "online").length;
  return { onlineDevices: online, offlineDevices: devices.length - online, activeAlerts: alerts.length, totalDevices: devices.length };
}

export const getDevices = (): Promise<Device[]> => listDevices();
export const getCpuMetrics = () => get<MetricPoint[]>("/metrics/cpu", cpuData);
export const getMemoryMetrics = () => get<MetricPoint[]>("/metrics/memory", memoryData);
export const getStorageMetrics = () => get<MetricPoint[]>("/metrics/storage", storageData);
export const getAlerts = (): Promise<Alert[]> => listAlerts("active");
export const getAccounts = () => get<Account[]>("/accounts", accounts);
export const getBillingSummary = () => get<BillingSummary>("/billing/summary", billingSummary);
