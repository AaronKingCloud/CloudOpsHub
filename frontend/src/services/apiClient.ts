import axios from "axios";

// Base URL of the backend. Set VITE_API_URL in frontend/.env.local (see .env.example).
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  timeout: 5000,
});

// Mock mode is ON unless VITE_USE_MOCK is explicitly "false".
// This lets the frontend run without the backend.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
