import type { BillingSummary } from "../types/Billing";

export const billingSummary: BillingSummary = {
  currentMonthSpend: 83.85,
  forecastedSpend: 142.3,
  currency: "USD",
  periodStart: "2026-11-01",
  periodEnd: "2026-11-30",
  source: "mock",
  serviceBreakdown: [
    {
      service: "Amazon Elastic Compute Cloud - Compute",
      amount: 42.8,
      currency: "USD",
      percentage: 51.0,
    },
    {
      service: "Amazon Relational Database Service",
      amount: 24.5,
      currency: "USD",
      percentage: 29.2,
    },
    {
      service: "Amazon Simple Storage Service",
      amount: 8.15,
      currency: "USD",
      percentage: 9.7,
    },
    {
      service: "Amazon CloudWatch",
      amount: 5.4,
      currency: "USD",
      percentage: 6.4,
    },
    {
      service: "AWS Key Management Service",
      amount: 3.0,
      currency: "USD",
      percentage: 3.6,
    },
  ],
};

