import { useEffect, useState } from "react";
import { deleteDevice } from "../../services/deviceService";
import type { Device } from "../../types/Dashboard";
import { getErrorMessage } from "../../utils/errors";

interface DeleteDeviceDialogProps {
  device: Device;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteDeviceDialog({ device, onClose, onDeleted }: DeleteDeviceDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const confirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteDevice(device.id);
      onDeleted();
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog panel form-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-device-title"
        aria-describedby="delete-device-text"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-device-title">Delete {device.hostname}?</h2>
        <p id="delete-device-text" className="dialog-text">
          Its history and alerts are removed, and its agent key stops working. This can't be undone.
        </p>
        {error && (
          <div className="notice warn" role="alert">
            <p className="notice-title">{error}</p>
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose} autoFocus>
            Keep device
          </button>
          <button type="button" className="btn danger" onClick={confirm} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete device"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteDeviceDialog;
