import type { Account } from "../types/Account";
import { accountTone } from "../utils/status";
import Modal from "./Modal";
import StatusBadge from "./StatusBadge";

interface AccountDetailModalProps {
  account: Account;
  onClose: () => void;
}

const STATUS_GUIDANCE: Record<Account["status"], string> = {
  Critical: "Immediate investigation recommended: review active alerts and resource thresholds.",
  Warning: "Monitor closely: elevated utilization or non-critical policy warnings detected.",
  Healthy: "All monitored checks are passing within normal operating thresholds.",
};

export default function AccountDetailModal({ account, onClose }: AccountDetailModalProps) {
  return (
    <Modal className="panel" labelledBy="account-title" onClose={onClose}>
      <div className="account-modal-header">
        <div>
          <h2 id="account-title">{account.accountName}</h2>
          <span className="billing-period">
            {account.provider} Environment • ID #{account.id}
          </span>
        </div>
        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="account-detail-grid">
        <div className="account-detail-item">
          <span className="label">Provider</span>
          <strong>{account.provider}</strong>
        </div>
        <div className="account-detail-item">
          <span className="label">Health Status</span>
          <div>
            <StatusBadge label={account.status} tone={accountTone(account.status)} />
          </div>
        </div>
        <div className="account-detail-item">
          <span className="label">Active Alerts</span>
          <strong>{account.alertCount}</strong>
        </div>
        <div className="account-detail-item">
          <span className="label">Last Synced</span>
          <strong>{account.lastUpdated}</strong>
        </div>
      </div>

      <div className="account-guidance">
        {STATUS_GUIDANCE[account.status]}
      </div>
    </Modal>
  );
}
