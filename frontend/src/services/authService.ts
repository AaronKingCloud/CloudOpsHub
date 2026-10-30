import { apiClient, USE_MOCK, setStoredToken, getStoredToken } from "./apiClient";
import type { LoginCredentials, TokenResponse, User } from "../types/Auth";
import { getMockLoginResponse, MOCK_USERS } from "../mock/auth";

export { getStoredToken, setStoredToken };

const USER_KEY = "cloudopshub_user";

export function getStoredUser(): User | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export async function loginUser(credentials: LoginCredentials): Promise<TokenResponse> {
  if (USE_MOCK) {
    // In mock mode, allow instant login for demo users or default viewer
    const response = getMockLoginResponse(credentials.username);
    setStoredToken(response.accessToken);
    setStoredUser(response.user);
    return response;
  }

  const res = await apiClient.post<TokenResponse>("/auth/login", credentials);
  setStoredToken(res.data.accessToken);
  setStoredUser(res.data.user);
  return res.data;
}

export async function getCurrentUser(): Promise<User> {
  if (USE_MOCK) {
    const cached = getStoredUser();
    if (cached) return cached;
    return MOCK_USERS.admin;
  }

  const res = await apiClient.get<User>("/auth/me");
  setStoredUser(res.data);
  return res.data;
}

export function logoutUser(): void {
  setStoredToken(null);
  setStoredUser(null);
}
