import { useEffect, useState, type FormEvent } from "react";
import { createUser } from "../../services/userService";
import { USER_LIMITS, type NewUser, type User, type UserRole } from "../../types/Auth";
import { getErrorMessage } from "../../utils/errors";

const ROLE_HELP: Record<UserRole, string> = {
  viewer: "Read-only dashboards",
  operator: "Day-to-day operations",
  admin: "Everything, including managing users",
};

type FieldErrors = Partial<Record<keyof NewUser, string>>;

// Mirrors the backend's UserCreate rules so most mistakes are caught before sending.
function validate(form: NewUser): FieldErrors {
  const errors: FieldErrors = {};
  const { username, email, password } = USER_LIMITS;
  if (form.username.trim().length < username.min || form.username.length > username.max) {
    errors.username = `Must be ${username.min}–${username.max} characters`;
  }
  if (!/^[^\s@]+@[^\s@]+$/.test(form.email) || form.email.length > email.max) {
    errors.email = "Enter a valid email address";
  }
  if (form.password.length < password.min || form.password.length > password.max) {
    errors.password = `Must be ${password.min}–${password.max} characters`;
  }
  return errors;
}

interface AddUserDialogProps {
  onClose: () => void;
  onCreated: (user: User) => void;
}

function AddUserDialog({ onClose, onCreated }: AddUserDialogProps) {
  const [form, setForm] = useState<NewUser>({ username: "", email: "", password: "", role: "viewer" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Esc closes the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const update = (field: keyof NewUser, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setServerError(null);
    try {
      const user = await createUser({ ...form, username: form.username.trim(), email: form.email.trim() });
      onCreated(user);
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog panel form-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <h2 id="add-user-title">Add user</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {serverError && (
          <div className="notice warn" role="alert">
            <p className="notice-title">{serverError}</p>
          </div>
        )}

        <form className="stack-form" onSubmit={handleSubmit} noValidate>
          <label>
            <span>Username</span>
            <input
              autoFocus
              autoComplete="off"
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              aria-invalid={!!fieldErrors.username}
            />
            {fieldErrors.username && <small className="field-error">{fieldErrors.username}</small>}
          </label>

          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              aria-invalid={!!fieldErrors.email}
            />
            {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
          </label>

          <label>
            <span>Temporary password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              aria-invalid={!!fieldErrors.password}
            />
            {fieldErrors.password ? (
              <small className="field-error">{fieldErrors.password}</small>
            ) : (
              <small className="field-hint">At least {USER_LIMITS.password.min} characters. Share it privately.</small>
            )}
          </label>

          <fieldset className="role-picker">
            <legend>Role</legend>
            {(Object.keys(ROLE_HELP) as UserRole[]).map((role) => (
              <label key={role} className={form.role === role ? "checked" : ""}>
                <input
                  type="radio"
                  name="role"
                  value={role}
                  checked={form.role === role}
                  onChange={() => update("role", role)}
                />
                <span className="role-name">{role}</span>
                <small>{ROLE_HELP[role]}</small>
              </label>
            ))}
          </fieldset>

          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddUserDialog;
