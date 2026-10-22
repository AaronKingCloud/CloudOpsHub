import { useApi } from "../hooks/useApi";
import { getAccounts } from "../services/dashboardService";

function AccountList() {
  const { data: accounts, loading, error } = useApi(getAccounts);

  if (loading) return <p>Loading accounts...</p>;
  if (error) return <p>Could not load accounts: {error}</p>;

  return (
    <div>
      <h2>Connected Accounts</h2>

      {accounts?.map((account) => (
        <div key={account.id}>
          <strong>{account.accountName}</strong>
          {" - "}
          {account.status}
          {" - "}
          {account.alertCount} Alerts
        </div>
      ))}
    </div>
  );
}

export default AccountList;
