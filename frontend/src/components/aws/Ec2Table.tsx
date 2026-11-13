import type { Ec2Instance } from "../../types/Aws";
import { ec2StateTone } from "../../utils/status";
import { timeAgo } from "../../utils/time";
import StatusBadge from "../StatusBadge";

interface Ec2TableProps {
  instances: Ec2Instance[];
  selectedId: string | null;
  onSelect: (instanceId: string) => void;
}

function Ec2Table({ instances, selectedId, onSelect }: Ec2TableProps) {
  if (instances.length === 0) {
    return <p className="state-message">No EC2 instances in this account and region.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>State</th>
            <th>Type</th>
            <th>Zone</th>
            <th>Private IP</th>
            <th>Launched</th>
          </tr>
        </thead>
        <tbody>
          {instances.map((inst) => (
            <tr key={inst.instanceId} className={`selectable ${inst.instanceId === selectedId ? "selected" : ""}`}>
              <td>
                <button
                  type="button"
                  className="row-select"
                  onClick={() => onSelect(inst.instanceId)}
                  aria-pressed={inst.instanceId === selectedId}
                  title="Show CPU for this instance"
                >
                  <span className="row-title">{inst.name}</span>
                  <span className="row-sub mono">{inst.instanceId}</span>
                </button>
              </td>
              <td>
                <StatusBadge label={inst.state} tone={ec2StateTone(inst.state)} />
              </td>
              <td className="mono">{inst.instanceType}</td>
              <td>{inst.availabilityZone}</td>
              <td className="mono">{inst.privateIp ?? "—"}</td>
              <td title={new Date(inst.launchTime).toLocaleString()}>{timeAgo(inst.launchTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Ec2Table;
