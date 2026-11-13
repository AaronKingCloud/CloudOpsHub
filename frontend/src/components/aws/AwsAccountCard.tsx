import { useApi } from "../../hooks/useApi";
import { getAwsAccount } from "../../services/awsService";
import { Skeleton } from "../PanelStatus";
import AwsErrorMessage from "./AwsErrorMessage";

function AwsAccountCard() {
  const { data: account, loading, error, errorStatus, reload } = useApi(getAwsAccount);

  return (
    <section className="panel">
      <h2>Connected AWS Account</h2>
      {loading && <Skeleton rows={2} />}
      {error && <AwsErrorMessage error={error} status={errorStatus} onRetry={reload} />}
      {account && (
        <dl className="kv-grid">
          <div>
            <dt>Account ID</dt>
            <dd className="mono">{account.accountId}</dd>
          </div>
          <div>
            <dt>Connected as</dt>
            <dd>{account.userName}</dd>
          </div>
          <div className="kv-wide">
            <dt>ARN</dt>
            <dd className="mono">{account.arn}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

export default AwsAccountCard;
