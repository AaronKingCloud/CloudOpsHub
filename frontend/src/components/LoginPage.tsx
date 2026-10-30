import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { USE_MOCK } from "../services/apiClient";

interface LoginPageProps {
  onClose?: () => void;
}

export default function LoginPage({ onClose }: LoginPageProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login({ username, password });
      onClose?.();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid username or password");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoUser: string, demoPass: string) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setError(null);
    void (async () => {
      try {
        setLoading(true);
        await login({ username: demoUser, password: demoPass });
        onClose?.();
      } catch {
        setError("Login failed. Check server status.");
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="login-card panel">
      <div className="login-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Sign in to CloudOps Hub</h2>
          {onClose && (
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
        <p className="login-sub">
          Cloud infrastructure monitoring &amp; operations
          {USE_MOCK ? " (Mock Mode)" : " (Live Backend)"}
        </p>
      </div>

      {error && <div className="login-error-banner">{error}</div>}

      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. admin, operator, or viewer"
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            disabled={loading}
            required
          />
        </div>

        <button type="submit" className="login-submit-btn" disabled={loading}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div className="quick-login-section">
        <span className="quick-login-title">Quick Demo Logins (Role-Based)</span>
        <div className="quick-login-buttons">
          <button
            type="button"
            className="quick-btn admin"
            onClick={() => handleQuickLogin("admin", "Admin123!")}
            title="Admin role: Full management & user controls"
          >
            <strong>Admin</strong>
            <small>Full Access</small>
          </button>
          <button
            type="button"
            className="quick-btn operator"
            onClick={() => handleQuickLogin("operator", "Operator123!")}
            title="Operator role: Operational & resource controls"
          >
            <strong>Operator</strong>
            <small>Operations</small>
          </button>
          <button
            type="button"
            className="quick-btn viewer"
            onClick={() => handleQuickLogin("viewer", "Viewer123!")}
            title="Viewer role: Read-only monitoring"
          >
            <strong>Viewer</strong>
            <small>Read-only</small>
          </button>
        </div>
      </div>
    </div>
  );
}
