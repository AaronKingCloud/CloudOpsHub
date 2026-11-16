// Billing types matching backend/app/schemas.py (BillingSummary & ServiceCost).

export interface ServiceCost {
  service: string;
  amount: number;
  currency: string;
  percentage: number;
}

export interface BillingSummary {
  currentMonthSpend: number;
  forecastedSpend: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  serviceBreakdown: ServiceCost[];
  source: "aws" | "mock";
}

