import { useApi } from "../hooks/useApi";
import { getAccounts } from "../services/dashboardService";
import { accountTone } from "../utils/status";
import StatusBadge from "./StatusBadge";

function AccountList() {
  const { data: accounts, loading, error } = useApi(getAccounts);

  return (
    <section className="panel">
      <h2>Connected Accounts</h2>
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
                <tr key={account.id}>
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
    </section>
  );
}

export default AccountList;
