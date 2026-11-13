// User management (admin only on the backend: GET /auth/users, POST /auth/register).

import { MOCK_USERS } from "../mock/auth";
import type { NewUser, User } from "../types/Auth";
import { apiClient, USE_MOCK } from "./apiClient";

// Mock mode keeps created users in memory until the page is reloaded.
const mockUsers: User[] = Object.values(MOCK_USERS);

export async function listUsers(): Promise<User[]> {
  if (USE_MOCK) return [...mockUsers].reverse();
  const res = await apiClient.get<User[]>("/auth/users");
  return res.data;
}

export async function createUser(body: NewUser): Promise<User> {
  if (USE_MOCK) {
    if (mockUsers.some((u) => u.username === body.username || u.email === body.email)) {
      throw new Error("Username or email already exists");
    }
    const user: User = {
      id: `usr-${body.username}-${Date.now()}`,
      username: body.username,
      email: body.email,
      role: body.role,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
    };
    mockUsers.push(user);
    return user;
  }
  const res = await apiClient.post<User>("/auth/register", body);
  return res.data;
}
