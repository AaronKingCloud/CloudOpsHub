import { useEffect, useState, type FormEvent } from "react";
import { changeOwnPassword } from "../../services/userService";
import { USER_LIMITS } from "../../types/Auth";
import { getErrorMessage } from "../../utils/errors";

interface ChangePasswordDialogProps {
  onClose: () => void;
}

type Field = "current" | "next" | "confirm";

// Any signed-in user can change their own password (POST /auth/me/password).
function ChangePasswordDialog({ onClose }: ChangePasswordDialogProps) {
  const [values, setValues] = useState<Record<Field, string>>({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const update = (field: Field, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const { min, max } = USER_LIMITS.password;
    const found: Partial<Record<Field, string>> = {};
    if (!values.current) found.current = "Enter your current password";
    if (values.next.length < min || values.next.length > max) found.next = `Must be ${min}–${max} characters`;
    else if (values.next === values.current) found.next = "Choose a password different from the current one";
    if (values.confirm !== values.next) found.confirm = "Doesn't match the new password";
    return found;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setServerError(null);
    try {
      await changeOwnPassword(values.current, values.next);
      setDone(true);
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const field = (name: Field, label: string, autoComplete: string, hint?: string) => (
    <label>
      <span>{label}</span>
      <input
        id={`password-${name}`}
        type="password"
        autoComplete={autoComplete}
        autoFocus={name === "current"}
        value={values[name]}
        onChange={(e) => update(name, e.target.value)}
        aria-invalid={!!errors[name]}
      />
      {errors[name] ? (
        <small className="field-error">{errors[name]}</small>
      ) : (
        hint && <small className="field-hint">{hint}</small>
      )}
    </label>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog panel form-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <h2 id="password-title">Change password</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {done ? (
          <>
            <div className="notice ok" role="status">
              <p className="notice-title">Password changed. Use the new one next time you sign in.</p>
            </div>
            <div className="form-actions">
              <button type="button" className="btn primary" onClick={onClose} autoFocus>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            {serverError && (
              <div className="notice warn" role="alert">
                <p className="notice-title">{serverError}</p>
              </div>
            )}
            <form className="stack-form" onSubmit={handleSubmit} noValidate>
              {field("current", "Current password", "current-password")}
              {field("next", "New password", "new-password", `At least ${USER_LIMITS.password.min} characters.`)}
              {field("confirm", "Confirm new password", "new-password")}
              <div className="form-actions">
                <button type="button" className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? "Saving…" : "Change password"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ChangePasswordDialog;
