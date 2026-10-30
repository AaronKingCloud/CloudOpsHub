import axios from "axios";

// Base URL of the backend. Set VITE_API_URL in frontend/.env.local (see .env.example).
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  timeout: 5000,
});

// Mock mode is ON unless VITE_USE_MOCK is explicitly "false".
// This lets the frontend run without the backend.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

const TOKEN_KEY = "cloudopshub_access_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// Automatically attach Bearer token to all outgoing requests if available.
apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
