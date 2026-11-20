import React, { useEffect, useState } from "react";
import type { LoginCredentials, User, UserRole } from "../types/Auth";
import { getCurrentUser, getStoredToken, getStoredUser, loginUser, logoutUser } from "../services/authService";
import { AUTH_REQUIRED_EVENT, SESSION_EXPIRED_EVENT } from "../services/apiClient";
import { can as canDo, type Action } from "../utils/permissions";
import { AuthContext } from "./authContextDef";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken();
      if (storedToken) {
        try {
          const profile = await getCurrentUser();
          setUser(profile);
          setToken(storedToken);
        } catch {
          // If token expired or invalid, reset
          logoutUser();
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    void initAuth();
  }, []);

  // apiClient fires this when the refresh token is also expired or invalid.
  useEffect(() => {
    const handleExpired = () => {
      logoutUser();
      setUser(null);
      setToken(null);
    };
    const handleAuthRequired = () => setAuthRequired(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
      window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const response = await loginUser(credentials);
    setUser(response.user);
    setToken(response.accessToken);
  };

  const logout = () => {
    logoutUser();
    setUser(null);
    setToken(null);
  };

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    const roleList = Array.isArray(roles) ? roles : [roles];
    return roleList.includes(user.role);
  };

  const can = (action: Action): boolean => canDo(user?.role, action);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        hasRole,
        can,
        authRequired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

