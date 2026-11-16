import type { UserRole } from "../../types/Auth";
import type { IconName } from "./Icon";

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  description: string;
  // If set, only users with one of these roles see the item.
  roles?: UserRole[];
}

// Single source of truth for the sidebar and page titles. Add new pages here.
export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Overview", icon: "overview", description: "What needs your attention right now" },
  { to: "/devices", label: "Devices", icon: "devices", description: "Health and resource usage of every monitored device" },
  { to: "/alerts", label: "Alerts", icon: "alerts", description: "Active alerts across your infrastructure" },
  { to: "/accounts", label: "Accounts", icon: "accounts", description: "Connected cloud accounts and subscriptions" },
  { to: "/cloud", label: "AWS Cloud", icon: "cloud", description: "Live EC2 instances and CloudWatch CPU from the connected AWS account" },
  { to: "/admin/users", label: "Users", icon: "users", description: "Who can sign in to CloudOps Hub, and with which role", roles: ["admin"] },
];
