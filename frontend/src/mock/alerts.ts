import type { Alert } from "../types/Dashboard";

export const alerts: Alert[] = [
  { id: 1, severity: "critical", message: "nas-01 storage exceeds 90%" },
  { id: 2, severity: "critical", message: "backup-vm is offline" },
  { id: 3, severity: "warning", message: "proxmox-host memory above 70%" },
];
