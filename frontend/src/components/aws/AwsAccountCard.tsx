import { useApi } from "../../hooks/useApi";
import { getAwsAccount } from "../../services/awsService";
import AwsErrorMessage from "./AwsErrorMessage";

function AwsAccountCard() {
  const { data: account, loading, error, errorStatus } = useApi(getAwsAccount);

  return (
    <section className="panel">
      <h2>Connected AWS Account</h2>
      {loading && <p className="state-message">Checking AWS connection...</p>}
      {error && <AwsErrorMessage error={error} status={errorStatus} />}
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
