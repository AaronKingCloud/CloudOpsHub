import { useEffect, useState, type FormEvent } from "react";
import { createDevice, updateDevice } from "../../services/deviceService";
import type { Device, DeviceInput, DeviceType } from "../../types/Dashboard";
import { DEVICE_TYPES } from "../../utils/deviceTypes";
import { getErrorMessage } from "../../utils/errors";

type FieldErrors = Partial<Record<keyof DeviceInput, string>>;

const HOSTNAME = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function validate(form: DeviceInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!HOSTNAME.test(form.hostname.trim())) {
    errors.hostname = "Use letters, numbers, dots and hyphens, like nas-01 or web.home.lan";
  }
  const ip = form.ipAddress?.trim();
  if (ip && !IPV4.test(ip) && !ip.includes(":")) {
    errors.ipAddress = "Enter an IPv4 address like 192.168.1.20, an IPv6 address, or leave it empty";
  }
  if ((form.description?.length ?? 0) > 200) {
    errors.description = "Keep it under 200 characters";
  }
  return errors;
}

interface DeviceFormDialogProps {
  device?: Device; // edit this device; omit to add a new one
  onClose: () => void;
  onSaved: (device: Device, agentKey?: string) => void;
}

function DeviceFormDialog({ device, onClose, onSaved }: DeviceFormDialogProps) {
  const [form, setForm] = useState<DeviceInput>({
    hostname: device?.hostname ?? "",
    type: device?.type ?? "server",
    ipAddress: device?.ipAddress ?? "",
    description: device?.description ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const update = (field: keyof DeviceInput, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const input: DeviceInput = {
      hostname: form.hostname.trim(),
      type: form.type,
      ipAddress: form.ipAddress?.trim() || null,
      description: form.description?.trim() || null,
    };
    setSaving(true);
    setServerError(null);
    try {
      if (device) {
        onSaved(await updateDevice(device.id, input));
      } else {
        const created = await createDevice(input);
        onSaved(created.device, created.agentKey);
      }
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const title = device ? `Edit ${device.hostname}` : "Add device";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog panel form-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <h2 id="device-form-title">{title}</h2>
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
            <span>Hostname</span>
            <input
              id="device-hostname"
              autoFocus
              autoComplete="off"
              value={form.hostname}
              onChange={(e) => update("hostname", e.target.value)}
              aria-invalid={!!fieldErrors.hostname}
            />
            {fieldErrors.hostname && <small className="field-error">{fieldErrors.hostname}</small>}
          </label>

          <label>
            <span>Type</span>
            <select id="device-type" value={form.type} onChange={(e) => update("type", e.target.value)}>
              {(Object.keys(DEVICE_TYPES) as DeviceType[]).map((t) => (
                <option key={t} value={t}>
                  {DEVICE_TYPES[t]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>IP address (optional)</span>
            <input
              id="device-ip"
              autoComplete="off"
              inputMode="decimal"
              value={form.ipAddress ?? ""}
              onChange={(e) => update("ipAddress", e.target.value)}
              aria-invalid={!!fieldErrors.ipAddress}
            />
            {fieldErrors.ipAddress && <small className="field-error">{fieldErrors.ipAddress}</small>}
          </label>

          <label>
            <span>Description (optional)</span>
            <input
              id="device-description"
              autoComplete="off"
              value={form.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
              aria-invalid={!!fieldErrors.description}
            />
            {fieldErrors.description && <small className="field-error">{fieldErrors.description}</small>}
          </label>

          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Saving…" : device ? "Save changes" : "Add device"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DeviceFormDialog;
