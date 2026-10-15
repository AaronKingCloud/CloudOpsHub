import { accounts } from "../mock/accounts";

function AccountList() {
  return (
    <div>
      <h2>Connected Accounts</h2>

      {accounts.map((account) => (
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
