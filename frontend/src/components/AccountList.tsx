import { useApi } from "../hooks/useApi";
import { useSort } from "../hooks/useSort";
import { getAccounts } from "../services/dashboardService";
import type { Account, AccountStatus } from "../types/Account";
import { accountTone } from "../utils/status";
import { ErrorState, Skeleton } from "./PanelStatus";
import SortableTh from "./SortableTh";
import StatusBadge from "./StatusBadge";

type AccountColumn = "accountName" | "provider" | "status" | "alertCount" | "lastUpdated";

const COLUMNS: { key: AccountColumn; label: string }[] = [
  { key: "accountName", label: "Account" },
  { key: "provider", label: "Provider" },
  { key: "status", label: "Status" },
  { key: "alertCount", label: "Alerts" },
  { key: "lastUpdated", label: "Last Updated" },
];

// Sort status by severity (Critical > Warning > Healthy), not alphabetically.
const STATUS_RANK: Record<AccountStatus, number> = { Critical: 2, Warning: 1, Healthy: 0 };
const getValue = (a: Account, key: AccountColumn) => (key === "status" ? STATUS_RANK[a.status] : a[key]);

function AccountList() {
  const { data: accounts, loading, error, reload } = useApi(getAccounts, { live: true });
  const { sorted, sort, toggle } = useSort(accounts, getValue, { key: "status", dir: "desc" });

  return (
    <section className="panel">
      <h2>Connected Accounts</h2>
      {loading && <Skeleton rows={4} />}
      {error && <ErrorState what="accounts" message={error} onRetry={reload} />}
      {sorted && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <SortableTh
                    key={c.key}
                    label={c.label}
                    active={sort.key === c.key}
                    dir={sort.dir}
                    onClick={() => toggle(c.key, sorted[0] ? getValue(sorted[0], c.key) : undefined)}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((account) => (
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
