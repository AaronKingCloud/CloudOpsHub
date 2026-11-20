import type { Device } from "../types/Dashboard";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const devices: Device[] = [
  { id: 1, hostname: "plex-server", status: "online", cpu: 25, memory: 48, storage: 62, type: "server", ipAddress: "192.168.1.20", description: "Media server in the rack", lastSeen: minutesAgo(1) },
  { id: 2, hostname: "nas-01", status: "online", cpu: 12, memory: 35, storage: 91, type: "nas", ipAddress: "192.168.1.30", description: "Synology NAS, backups and media", lastSeen: minutesAgo(1) },
  { id: 3, hostname: "proxmox-host", status: "online", cpu: 68, memory: 74, storage: 40, type: "server", ipAddress: "192.168.1.10", description: "Hypervisor for the homelab VMs", lastSeen: minutesAgo(2) },
  { id: 4, hostname: "pihole", status: "online", cpu: 5, memory: 22, storage: 18, type: "container", ipAddress: "192.168.1.53", description: "DNS ad blocker", lastSeen: minutesAgo(1) },
  { id: 5, hostname: "backup-vm", status: "offline", cpu: 0, memory: 0, storage: 77, type: "vm", ipAddress: "192.168.1.41", description: "Nightly backup jobs", lastSeen: minutesAgo(190) },
];
