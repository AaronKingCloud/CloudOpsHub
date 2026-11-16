import { useState } from "react";
import AwsAccountCard from "../components/aws/AwsAccountCard";
import AwsErrorMessage from "../components/aws/AwsErrorMessage";
import Ec2CpuPanel from "../components/aws/Ec2CpuPanel";
import Ec2Table from "../components/aws/Ec2Table";
import Icon from "../components/layout/Icon";
import PageHeader from "../components/layout/PageHeader";
import { Skeleton } from "../components/PanelStatus";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { USE_MOCK } from "../services/apiClient";
import { getEc2Instances } from "../services/awsService";
import "../styles/cloud.css";

// The backend requires sign-in for every /aws/* endpoint.
function CloudPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!USE_MOCK && !isLoading && !isAuthenticated) {
    return (
      <>
        <PageHeader />
        <section className="panel empty-page">
          <h2>Sign in to view AWS resources</h2>
          <p className="state-message">
            AWS data comes from the live account, so it's only shown to signed-in users. Use{" "}
            <strong>Sign in</strong> at the top right.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader />
      <AwsAccountCard />
      <Ec2Section />
    </>
  );
}

function Ec2Section() {
  // Not auto-refreshed (AWS API quotas); the refresh button reloads on demand.
  const { data: instances, loading, error, errorStatus, refreshing, reload } = useApi(getEc2Instances);
  const [chosenId, setChosenId] = useState<string | null>(null);

  // Default to the first running instance until the user picks one.
  const selected =
    instances?.find((i) => i.instanceId === chosenId) ??
    instances?.find((i) => i.state === "running") ??
    instances?.[0] ??
    null;

  const running = instances?.filter((i) => i.state === "running").length ?? 0;

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <h2>EC2 Instances</h2>
          <div className="panel-tools">
            {instances && (
              <span className="panel-subtitle">
                {refreshing ? "Refreshing…" : `${running} running · ${instances.length} total`}
              </span>
            )}
            <button type="button" className="icon-btn" onClick={reload} title="Refresh instances" aria-label="Refresh instances">
              <Icon name="refresh" size={16} />
            </button>
          </div>
        </div>
        {loading && <Skeleton rows={3} />}
        {error && <AwsErrorMessage error={error} status={errorStatus} onRetry={reload} />}
        {instances && (
          <Ec2Table instances={instances} selectedId={selected?.instanceId ?? null} onSelect={setChosenId} />
        )}
      </section>

      {selected && <Ec2CpuPanel key={selected.instanceId} instance={selected} />}
    </>
  );
}

export default CloudPage;
