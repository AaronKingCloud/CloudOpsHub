// Maps domain statuses to the CSS tone classes (ok / warn / crit / info / muted) used by badges.

import type { AccountStatus } from "../types/Account";
import type { AlertSeverity, DeviceStatus } from "../types/Dashboard";

export type Tone = "ok" | "warn" | "crit" | "info" | "muted";

const ACCOUNT_TONES: Record<AccountStatus, Tone> = {
  Healthy: "ok",
  Warning: "warn",
  Critical: "crit",
};

const ALERT_TONES: Record<AlertSeverity, Tone> = {
  info: "info",
  warning: "warn",
  critical: "crit",
};

export const accountTone = (status: AccountStatus): Tone => ACCOUNT_TONES[status];

export const alertTone = (severity: AlertSeverity): Tone => ALERT_TONES[severity];

export const deviceTone = (status: DeviceStatus): Tone => (status === "online" ? "ok" : "crit");

// Thresholds for CPU / memory / storage percentages.
export function usageTone(percent: number): Tone {
  if (percent >= 90) return "crit";
  if (percent >= 70) return "warn";
  return "ok";
}

// EC2 instance state -> badge colour. Stopped is normal (not an error), so it's muted.
export function ec2StateTone(state: string): Tone {
  if (state === "running") return "ok";
  if (state === "stopped") return "muted";
  if (state === "terminated") return "crit";
  return "info"; // pending, stopping, shutting-down
}
