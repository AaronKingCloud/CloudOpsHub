import { useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import { ErrorState, Skeleton } from "../components/PanelStatus";
import StatusBadge from "../components/StatusBadge";
import AddUserDialog from "../components/users/AddUserDialog";
import EditUserDialog from "../components/users/EditUserDialog";
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

// What changed, in words, for the confirmation message.
function describeChange(before: User, after: User): string {
  const parts = [];
  if (before.role !== after.role) parts.push(`role ${before.role} → ${after.role}`);
  if (before.isActive !== after.isActive) parts.push(after.isActive ? "re-enabled" : "disabled (can't sign in)");
  return `${after.username}: ${parts.join(", ")}.`;
}

function UserManagement() {
  const { user: me } = useAuth();
  const { data: users, loading, error, refreshing, reload } = useApi(listUsers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const handleCreated = (user: User) => {
    setDialogOpen(false);
    setMessage(`Created ${user.username} as ${user.role}. Share their temporary password privately.`);
    setHighlightId(user.id);
    reload();
  };

  const handleSaved = (before: User, after: User) => {
    setEditing(null);
    setMessage(`Updated ${describeChange(before, after)}`);
    setHighlightId(after.id);
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

      {message && (
        <div className="notice ok" role="status">
          <p className="notice-title">{message}</p>
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
        {loading && <Skeleton rows={4} />}
        {error && <ErrorState what="users" message={error} onRetry={reload} />}
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
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={u.id === highlightId ? "highlight" : ""}>
                    <td>
                      <span className="row-title">
                        {u.username}
                        {u.id === me?.id && <span className="you-tag"> (you)</span>}
                      </span>
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
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => setEditing(u)}
                        aria-label={`Edit ${u.username}`}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialogOpen && <AddUserDialog onClose={() => setDialogOpen(false)} onCreated={handleCreated} />}
      {editing && (
        <EditUserDialog
          user={editing}
          isSelf={editing.id === me?.id}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

export default UsersPage;
