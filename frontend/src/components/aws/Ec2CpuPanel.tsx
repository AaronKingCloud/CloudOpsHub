import { useCallback, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { getEc2Cpu } from "../../services/awsService";
import type { Ec2Instance } from "../../types/Aws";
import MetricChart from "../MetricChart";
import { Skeleton } from "../PanelStatus";
import AwsErrorMessage from "./AwsErrorMessage";

const RANGES = [1, 3, 6, 12, 24];

interface Ec2CpuPanelProps {
  instance: Ec2Instance;
}

function Ec2CpuPanel({ instance }: Ec2CpuPanelProps) {
  const [hours, setHours] = useState(3);
  const fetchCpu = useCallback(() => getEc2Cpu(instance.instanceId, hours), [instance.instanceId, hours]);
  const { data, loading, error, errorStatus, reload } = useApi(fetchCpu);

  const values = data?.map((p) => p.value) ?? [];
  const stats = values.length
    ? {
        average: values.reduce((a, b) => a + b, 0) / values.length,
        peak: Math.max(...values),
        latest: values[values.length - 1],
      }
    : null;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>
          CPU Utilization <span className="panel-subtitle">· {instance.name}</span>
        </h2>
        <div className="segmented" role="group" aria-label="Time range">
          {RANGES.map((h) => (
            <button
              key={h}
              type="button"
              className={h === hours ? "active" : ""}
              aria-pressed={h === hours}
              onClick={() => setHours(h)}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>

      {loading && <Skeleton height={240} />}
      {error && <AwsErrorMessage error={error} status={errorStatus} onRetry={reload} />}

      {data && data.length === 0 && (
        <p className="state-message">
          No CPU data for the last {hours}h
          {instance.state !== "running" ? ` (instance is ${instance.state}).` : ". New instances can take a few minutes to report."}
        </p>
      )}

      {data && data.length > 0 && stats && (
        <>
          <div className="metric-stats">
            <div>
              <span className="label">Average</span>
              <span className="value">{stats.average.toFixed(1)}%</span>
            </div>
            <div>
              <span className="label">Peak</span>
              <span className="value">{stats.peak.toFixed(1)}%</span>
            </div>
            <div>
              <span className="label">Latest</span>
              <span className="value">{stats.latest.toFixed(1)}%</span>
            </div>
          </div>
          <MetricChart data={data} label="CPU" />
        </>
      )}
    </section>
  );
}

export default Ec2CpuPanel;
