import { useSort } from "../../hooks/useSort";
import type { Ec2Instance } from "../../types/Aws";
import { ec2StateTone } from "../../utils/status";
import { timeAgo } from "../../utils/time";
import SortableTh from "../SortableTh";
import StatusBadge from "../StatusBadge";

type Ec2Column = "name" | "state" | "instanceType" | "availabilityZone" | "privateIp" | "launchTime";

const COLUMNS: { key: Ec2Column; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "state", label: "State" },
  { key: "instanceType", label: "Type" },
  { key: "availabilityZone", label: "Zone" },
  { key: "privateIp", label: "Private IP" },
  { key: "launchTime", label: "Launched" },
];

const getValue = (inst: Ec2Instance, key: Ec2Column): string | number =>
  key === "launchTime" ? new Date(inst.launchTime).getTime() : (inst[key] ?? "");

interface Ec2TableProps {
  instances: Ec2Instance[];
  selectedId: string | null;
  onSelect: (instanceId: string) => void;
}

function Ec2Table({ instances, selectedId, onSelect }: Ec2TableProps) {
  const { sorted, sort, toggle } = useSort(instances, getValue, { key: "name", dir: "asc" });

  if (!sorted || sorted.length === 0) {
    return <p className="state-message">No EC2 instances in this account and region.</p>;
  }

  return (
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
                onClick={() => toggle(c.key, getValue(sorted[0], c.key))}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((inst) => (
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
