import type { Account } from "../types/Account";

export const accounts: Account[] = [
  {
    id: 1,
    provider: "AWS",
    accountName: "AWS Production",
    status: "Critical",
    alertCount: 2,
    lastUpdated: "2026-10-15 13:00",
  },
  {
    id: 2,
    provider: "AWS",
    accountName: "AWS Sandbox",
    status: "Healthy",
    alertCount: 0,
    lastUpdated: "2026-10-15 13:00",
  },
  {
    id: 3,
    provider: "Azure",
    accountName: "Azure Development",
    status: "Warning",
    alertCount: 1,
    lastUpdated: "2026-10-15 13:00",
  },
  {
    id: 4,
    provider: "Azure",
    accountName: "Azure Production",
    status: "Healthy",
    alertCount: 0,
    lastUpdated: "2026-10-15 13:00",
  },
];