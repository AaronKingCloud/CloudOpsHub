// User management. Admin only: GET /auth/users, POST /auth/register, PATCH /auth/users/{id}.
// Any signed-in user: POST /auth/me/password.

import { MOCK_USERS } from "../mock/auth";
import type { NewUser, User, UserChanges } from "../types/Auth";
import { apiClient, USE_MOCK } from "./apiClient";
import { getStoredUser } from "./authService";

// Mock mode keeps created users in memory until the page is reloaded.
const mockUsers: User[] = Object.values(MOCK_USERS);

export async function listUsers(): Promise<User[]> {
  // Copies, like a real API response, so the page never holds the mock's own objects.
  if (USE_MOCK) return [...mockUsers].reverse().map((u) => ({ ...u }));
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

// Change a user's role or enable / disable them. The backend refuses (400) when an admin
// tries to demote or disable themselves; the mock does the same.
export async function updateUser(id: string, changes: UserChanges): Promise<User> {
  if (USE_MOCK) {
    const user = mockUsers.find((u) => u.id === id);
    if (!user) throw new Error("User not found");
    const me = getStoredUser();
    if (me?.id === id && changes.role && changes.role !== "admin") throw new Error("Admins cannot demote themselves");
    if (me?.id === id && changes.isActive === false) throw new Error("Admins cannot disable themselves");
    Object.assign(user, changes);
    return { ...user };
  }
  const res = await apiClient.patch<User>(`/auth/users/${encodeURIComponent(id)}`, changes);
  return res.data;
}

// Demo passwords from backend/seed.py, so mock mode can reject a wrong current password like the backend.
const MOCK_PASSWORDS: Record<string, string> = { admin: "Admin123!", operator: "Operator123!", viewer: "Viewer123!" };

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  if (USE_MOCK) {
    const me = getStoredUser();
    const expected = me ? MOCK_PASSWORDS[me.username] : undefined;
    if (expected !== undefined && currentPassword !== expected) throw new Error("Current password is incorrect");
    if (me) MOCK_PASSWORDS[me.username] = newPassword;
    return;
  }
  await apiClient.post("/auth/me/password", { currentPassword, newPassword });
}
