import { createContext } from "react";
import type { LoginCredentials, User, UserRole } from "../types/Auth";
import type { Action } from "../utils/permissions";

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  // Permission check from utils/permissions.ts, e.g. can("manageDevices").
  can: (action: Action) => boolean;
  // True once the backend has asked for a sign-in (it returned 401 with nobody signed in).
  authRequired: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

