// Who may do what. The backend enforces the same rules (403); this only hides buttons people can't use.
// Keep in sync with docs/api/frontend-contract.md and the backend's require_role(...) checks.

import type { UserRole } from "../types/Auth";

export type Action =
  | "manageUsers" // list and add users
  | "manageDevices" // add, edit, delete devices; rotate agent keys
  | "handleAlerts"; // acknowledge and resolve alerts

const RULES: Record<Action, UserRole[]> = {
  manageUsers: ["admin"],
  manageDevices: ["admin"],
  handleAlerts: ["admin", "operator"],
};

export function can(role: UserRole | null | undefined, action: Action): boolean {
  return !!role && RULES[action].includes(role);
}
