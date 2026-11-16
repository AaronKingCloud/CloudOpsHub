import { useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import StatusBadge from "../components/StatusBadge";
import AddUserDialog from "../components/users/AddUserDialog";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { listUsers } from "../services/userService";
import type { User } from "../types/Auth";
import { roleTone } from "../utils/status";
import { timeAgo } from "../utils/time";
import "../styles/users.css";

// Admin only. The sidebar hides the link for other roles, and this guard covers direct URLs.
// The backend enforces the same rule (403 for non-admins).
function UsersPage() {
  const { hasRole, isLoading } = useAuth();

  if (isLoading) return null;
  if (!hasRole("admin")) {
    return (
      <section className="panel empty-page">
        <h2>Admins only</h2>
        <p className="state-message">You need the admin role to manage users. Sign in as an admin to continue.</p>
      </section>
    );
  }
  return <UserManagement />;
}

function UserManagement() {
  const { data: users, loading, error, refreshing, reload } = useApi(listUsers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [created, setCreated] = useState<User | null>(null);

  const handleCreated = (user: User) => {
    setDialogOpen(false);
    setCreated(user);
    reload();
  };

  return (
    <>
      <PageHeader
        actions={
          <button type="button" className="btn primary" onClick={() => setDialogOpen(true)}>
            + Add user
          </button>
        }
      />

      {created && (
        <div className="notice ok" role="status">
          <p className="notice-title">
            Created <strong>{created.username}</strong> as {created.role}. Share their temporary password privately.
          </p>
        </div>
      )}

      <section className="panel">
        <div className="panel-header">
          <h2>Users</h2>
          {users && (
            <span className="panel-subtitle">
              {refreshing ? "Updating…" : `${users.length} ${users.length === 1 ? "account" : "accounts"}`}
            </span>
          )}
        </div>
        {loading && <p className="state-message">Loading users...</p>}
        {error && <p className="state-message">Could not load users: {error}</p>}
        {users && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={u.id === created?.id ? "highlight" : ""}>
                    <td>
                      <span className="row-title">{u.username}</span>
                      <span className="row-sub">{u.email}</span>
                    </td>
                    <td>
                      <StatusBadge label={u.role} tone={roleTone(u.role)} />
                    </td>
                    <td>
                      <StatusBadge label={u.isActive ? "active" : "disabled"} tone={u.isActive ? "ok" : "muted"} />
                    </td>
                    <td title={new Date(u.createdAt).toLocaleString()}>{timeAgo(u.createdAt)}</td>
                    <td title={u.lastLogin ? new Date(u.lastLogin).toLocaleString() : undefined}>
                      {u.lastLogin ? timeAgo(u.lastLogin) : <span className="state-message">Never</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialogOpen && <AddUserDialog onClose={() => setDialogOpen(false)} onCreated={handleCreated} />}
    </>
  );
}

export default UsersPage;
