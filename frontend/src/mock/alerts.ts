import type { Alert } from "../types/Dashboard";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const alerts: Alert[] = [
  { id: 1, severity: "critical", message: "nas-01 storage exceeds 90%", deviceId: 2, status: "open", createdAt: minutesAgo(42) },
  { id: 2, severity: "critical", message: "backup-vm is offline", deviceId: 5, status: "open", createdAt: minutesAgo(185) },
  { id: 3, severity: "warning", message: "proxmox-host memory above 70%", deviceId: 3, status: "open", createdAt: minutesAgo(15) },
  { id: 4, severity: "warning", message: "plex-server CPU above 70%", deviceId: 1, status: "resolved", createdAt: minutesAgo(60 * 26), acknowledgedBy: "operator", resolvedAt: minutesAgo(60 * 25) },
];
