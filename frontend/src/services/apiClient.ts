import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

// Base URL of the backend. Set VITE_API_URL in frontend/.env.local (see .env.example).
export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
});

// Mock mode is ON unless VITE_USE_MOCK is explicitly "false".
// This lets the frontend run without the backend.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

const TOKEN_KEY = "cloudopshub_access_token";
const REFRESH_TOKEN_KEY = "cloudopshub_refresh_token";

// Fired when the session can't be renewed, so AuthProvider can sign the user out.
export const SESSION_EXPIRED_EVENT = "cloudopshub:session-expired";

function storeOrRemove(key: string, value: string | null): void {
  if (value) {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  storeOrRemove(TOKEN_KEY, token);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredRefreshToken(token: string | null): void {
  storeOrRemove(REFRESH_TOKEN_KEY, token);
}

// Automatically attach Bearer token to all outgoing requests if available.
apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Silent token refresh ──────────────────────────────────────────────
// Access tokens expire after 30 minutes. When a request gets a 401, swap the
// refresh token for a new access token and retry the request once.

let refreshInFlight: Promise<string> | null = null;

async function requestNewAccessToken(): Promise<string> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token");
  }
  // Plain axios (not apiClient) so this call never triggers the interceptor below.
  const res = await axios.post<{ accessToken: string }>(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
    { timeout: 5000 },
  );
  setStoredToken(res.data.accessToken);
  return res.data.accessToken;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const isAuthCall = original?.url?.startsWith("/auth/login") || original?.url?.startsWith("/auth/refresh");

    if (error.response?.status !== 401 || !original || original._retried || isAuthCall || !getStoredRefreshToken()) {
      return Promise.reject(error);
    }

    original._retried = true;
    try {
      // Several requests can fail at once; they all wait on the same refresh.
      refreshInFlight ??= requestNewAccessToken().finally(() => {
        refreshInFlight = null;
      });
      const newToken = await refreshInFlight;
      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(original);
    } catch {
      setStoredToken(null);
      setStoredRefreshToken(null);
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      return Promise.reject(error);
    }
  },
);
