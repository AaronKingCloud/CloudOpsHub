// Authentication types matching backend schemas in backend/app/auth/schemas.py

export type UserRole = "admin" | "operator" | "viewer";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: User;
}

export interface AccessTokenResponse {
  accessToken: string;
  tokenType: string;
}


// Body of POST /auth/register (admin only). Limits match UserCreate in backend/app/auth/schemas.py.
export interface NewUser {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export const USER_LIMITS = {
  username: { min: 3, max: 50 },
  email: { min: 5, max: 255 },
  password: { min: 8, max: 128 },
} as const;
