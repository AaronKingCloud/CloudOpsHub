import { useState } from "react";
import { deleteDevice } from "../../services/deviceService";
import type { Device } from "../../types/Dashboard";
import { getErrorMessage } from "../../utils/errors";
import Modal from "../Modal";

interface DeleteDeviceDialogProps {
  device: Device;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteDeviceDialog({ device, onClose, onDeleted }: DeleteDeviceDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <Modal
      className="panel form-dialog"
      role="alertdialog"
      labelledBy="delete-device-title"
      describedBy="delete-device-text"
      onClose={onClose}
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
        <button type="button" className="btn" onClick={onClose} data-autofocus>
          Keep device
        </button>
        <button type="button" className="btn danger" onClick={confirm} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete device"}
        </button>
      </div>
    </Modal>
  );
}

export default DeleteDeviceDialog;
