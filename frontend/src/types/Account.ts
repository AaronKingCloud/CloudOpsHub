export type AccountStatus =
  | "Healthy"
  | "Warning"
  | "Critical";

export interface Account {
  id: number;
  provider: string;
  accountName: string;
  status: AccountStatus;
  alertCount: number;
  lastUpdated: string;
}