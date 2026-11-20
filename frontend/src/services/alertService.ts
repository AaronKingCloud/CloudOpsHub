// Alerts and alert actions. Acknowledge / resolve are the PROPOSED contract in
// docs/api/frontend-contract.md ("Alerts (proposed)"): backend task REMAINING_WORK B4.

import { mockAlerts } from "../mock/store";
import type { Alert } from "../types/Dashboard";
import { apiClient, USE_MOCK } from "./apiClient";
import { getStoredUser } from "./authService";

// "active" = open + acknowledged (what needs attention). "all" includes resolved, for history.
export type AlertScope = "active" | "all";

const isActive = (a: Alert) => (a.status ?? "open") !== "resolved";

export async function listAlerts(scope: AlertScope = "active"): Promise<Alert[]> {
  if (USE_MOCK) {
    return mockAlerts.filter((a) => scope === "all" || isActive(a)).map((a) => ({ ...a }));
  }
  const alerts = (await apiClient.get<Alert[]>("/alerts", { params: scope === "all" ? { status: "all" } : {} })).data;
  // Today's backend ignores ?status and has no status field; treat everything as active.
  return scope === "all" ? alerts : alerts.filter(isActive);
}

function updateMock(id: number, changes: Partial<Alert>): Alert {
  const alert = mockAlerts.find((a) => a.id === id);
  if (!alert) throw new Error("This alert doesn't exist anymore.");
  Object.assign(alert, changes);
  return { ...alert };
}

// "Someone is on it": stays visible but no longer unowned.
export async function acknowledgeAlert(id: number): Promise<Alert> {
  if (USE_MOCK) return updateMock(id, { status: "acknowledged", acknowledgedBy: getStoredUser()?.username ?? "you" });
  return (await apiClient.post<Alert>(`/alerts/${id}/acknowledge`)).data;
}

export async function resolveAlert(id: number): Promise<Alert> {
  if (USE_MOCK) return updateMock(id, { status: "resolved", resolvedAt: new Date().toISOString() });
  return (await apiClient.post<Alert>(`/alerts/${id}/resolve`)).data;
}
