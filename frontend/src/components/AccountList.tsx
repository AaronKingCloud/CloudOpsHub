import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { getAccounts } from "../services/dashboardService";
import type { Account } from "../types/Account";
import { accountTone } from "../utils/status";
import AccountDetailModal from "./AccountDetailModal";
import StatusBadge from "./StatusBadge";

function AccountList() {
  const { data: accounts, loading, error } = useApi(getAccounts);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  return (
    <section className="panel">
      <div className="billing-header">
        <h2>Connected Accounts</h2>
        <span className="billing-period">Click an account to inspect details</span>
      </div>
      {loading && <p className="state-message">Loading accounts...</p>}
      {error && <p className="state-message">Could not load accounts: {error}</p>}
      {accounts && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Alerts</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className="clickable-row"
                  onClick={() => setSelectedAccount(account)}
                >
                  <td>{account.accountName}</td>
                  <td>{account.provider}</td>
                  <td>
                    <StatusBadge label={account.status} tone={accountTone(account.status)} />
                  </td>
                  <td>{account.alertCount}</td>
                  <td>{account.lastUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedAccount && (
        <AccountDetailModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
        />
      )}
    </section>
  );
}

export default AccountList;
