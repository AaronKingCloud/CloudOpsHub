import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../types/Auth";
import LoginPage from "./LoginPage";

const ROLE_BADGES: Record<UserRole, { label: string; toneClass: string }> = {
  admin: { label: "Admin", toneClass: "badge crit" },
  operator: { label: "Operator", toneClass: "badge ok" },
  viewer: { label: "Viewer", toneClass: "badge info" },
};

export default function UserNav() {
  const { user, logout } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const roleInfo = user
    ? (ROLE_BADGES[user.role] ?? { label: user.role, toneClass: "badge info" })
    : null;

  return (
    <>
      <div className="user-nav">
        {user ? (
          <>
            <span className="user-greeting">
              Signed in as <strong>{user.username}</strong>
            </span>
            <span className={roleInfo?.toneClass}>{roleInfo?.label}</span>
            <button
              type="button"
              className="logout-btn"
              onClick={logout}
              title="Sign out of CloudOps Hub"
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            type="button"
            className="login-trigger-btn"
            onClick={() => setShowModal(true)}
            title="Sign in with role-based access"
          >
            Sign in
          </button>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <LoginPage onClose={() => setShowModal(false)} />
          </div>
        </div>
      )}
    </>
  );
}
