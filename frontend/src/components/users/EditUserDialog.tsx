import { useEffect, useState, type FormEvent } from "react";
import { updateUser } from "../../services/userService";
import type { User, UserChanges, UserRole } from "../../types/Auth";
import { getErrorMessage } from "../../utils/errors";

const ROLE_HELP: Record<UserRole, string> = {
  viewer: "Read-only dashboards",
  operator: "Also acknowledges and resolves alerts",
  admin: "Everything, including users and devices",
};

interface EditUserDialogProps {
  user: User;
  isSelf: boolean; // admins can't demote or disable themselves (the backend refuses too)
  onClose: () => void;
  onSaved: (before: User, after: User) => void;
}

function EditUserDialog({ user, isSelf, onClose, onSaved }: EditUserDialogProps) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const changes: UserChanges = {};
  if (role !== user.role) changes.role = role;
  if (isActive !== user.isActive) changes.isActive = isActive;
  const hasChanges = Object.keys(changes).length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return onClose();
    setSaving(true);
    setError(null);
    try {
      onSaved(user, await updateUser(user.id, changes));
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog panel form-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <h2 id="edit-user-title">Edit {user.username}</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {isSelf && (
          <div className="notice warn" role="note">
            <p className="notice-title">This is your own account. Another admin has to change your role or disable it.</p>
          </div>
        )}
        {error && (
          <div className="notice warn" role="alert">
            <p className="notice-title">{error}</p>
          </div>
        )}

        <form className="stack-form" onSubmit={handleSubmit}>
          <fieldset className="role-picker" disabled={isSelf}>
            <legend>Role</legend>
            {(Object.keys(ROLE_HELP) as UserRole[]).map((r) => (
              <label key={r} className={role === r ? "checked" : ""}>
                <input type="radio" name="edit-role" value={r} checked={role === r} onChange={() => setRole(r)} />
                <span className="role-name">{r}</span>
                <small>{ROLE_HELP[r]}</small>
              </label>
            ))}
          </fieldset>

          <label className="check-row">
            <input
              id="edit-user-active"
              type="checkbox"
              checked={isActive}
              disabled={isSelf}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>
              Account active
              <small className="field-hint">
                {isActive ? "Can sign in." : "Can't sign in; signed-in sessions stop working at once."}
              </small>
            </span>
          </label>

          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving || isSelf || !hasChanges}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditUserDialog;
