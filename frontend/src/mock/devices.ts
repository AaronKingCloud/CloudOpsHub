import type { Device } from "../types/Dashboard";

export const devices: Device[] = [
  { id: 1, hostname: "plex-server", status: "online", cpu: 25, memory: 48, storage: 62 },
  { id: 2, hostname: "nas-01", status: "online", cpu: 12, memory: 35, storage: 91 },
  { id: 3, hostname: "proxmox-host", status: "online", cpu: 68, memory: 74, storage: 40 },
  { id: 4, hostname: "pihole", status: "online", cpu: 5, memory: 22, storage: 18 },
  { id: 5, hostname: "backup-vm", status: "offline", cpu: 0, memory: 0, storage: 77 },
];
