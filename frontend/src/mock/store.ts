// In-memory "database" for mock mode, so adding devices or acknowledging alerts works without
// a backend. Resets when the page reloads. Seeded from the static mock data.

import type { Alert, Device, DeviceMetric, MetricPoint } from "../types/Dashboard";
import { alerts as seedAlerts } from "./alerts";
import { devices as seedDevices } from "./devices";

export const mockDevices: Device[] = seedDevices.map((d) => ({ ...d }));
export const mockAlerts: Alert[] = seedAlerts.map((a) => ({ ...a }));

export function nextId(items: { id: number }[]): number {
  return items.reduce((max, i) => Math.max(max, i.id), 0) + 1;
}

// Agent keys look like "coa_" + 32 hex characters.
export function newAgentKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "coa_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Deterministic fake history around the device's current value, so charts don't jump on every render.
// 5-minute points up to 24h, hourly points beyond. Offline devices stop reporting at lastSeen.
export function mockHistory(device: Device, metric: DeviceMetric, hours: number): MetricPoint[] {
  if (!device.lastSeen) return []; // never reported (e.g. just added)
  const stepMinutes = hours <= 24 ? 5 : 60;
  const count = Math.round((hours * 60) / stepMinutes);
  const end = device.status === "offline" && device.lastSeen ? new Date(device.lastSeen) : new Date();
  end.setSeconds(0, 0);
  end.setMinutes(end.getMinutes() - (end.getMinutes() % stepMinutes));

  const current = device.status === "offline" ? (metric === "storage" ? device.storage : 35) : device[metric];
  const seed = device.id * 7 + metric.length;
  const wobble = metric === "storage" ? 1.5 : 10;
  const points: MetricPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = new Date(end.getTime() - i * stepMinutes * 60_000);
    // Two slow waves at unrelated speeds plus small hashed noise, so it looks like real load.
    const noise = ((Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1) * (wobble / 4);
    const wave = Math.sin((i + seed) / 17) * wobble + Math.sin((i + seed * 3) / 5.3) * (wobble / 2.5) + noise;
    // Storage only grows slowly; the others move around the current value.
    const drift = metric === "storage" ? -(i / count) * 4 : 0;
    const value = Math.min(100, Math.max(0, current + wave * (i === 0 ? 0 : 1) + drift));
    points.push({ timestamp: formatTimestamp(t, hours), value: Math.round(value * 10) / 10 });
  }
  return points;
}

function formatTimestamp(t: Date, hours: number): string {
  const time = t.toTimeString().slice(0, 5);
  if (hours <= 24) return time;
  return `${t.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
}
