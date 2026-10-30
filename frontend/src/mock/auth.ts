import type { TokenResponse, User } from "../types/Auth";

export const MOCK_USERS: Record<string, User> = {
  admin: {
    id: "usr-admin-001",
    username: "admin",
    email: "admin@cloudopshub.local",
    role: "admin",
    isActive: true,
    createdAt: "2026-10-01T00:00:00Z",
    lastLogin: new Date().toISOString(),
  },
  operator: {
    id: "usr-operator-002",
    username: "operator",
    email: "operator@cloudopshub.local",
    role: "operator",
    isActive: true,
    createdAt: "2026-10-05T00:00:00Z",
    lastLogin: new Date().toISOString(),
  },
  viewer: {
    id: "usr-viewer-003",
    username: "viewer",
    email: "viewer@cloudopshub.local",
    role: "viewer",
    isActive: true,
    createdAt: "2026-10-10T00:00:00Z",
    lastLogin: new Date().toISOString(),
  },
};

export function getMockLoginResponse(username: string): TokenResponse {
  const user = MOCK_USERS[username] || {
    id: `usr-${username}-custom`,
    username,
    email: `${username}@cloudopshub.local`,
    role: "viewer" as const,
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  return {
    accessToken: `mock-jwt-token-for-${user.username}`,
    refreshToken: `mock-refresh-token-for-${user.username}`,
    tokenType: "bearer",
    user,
  };
}

