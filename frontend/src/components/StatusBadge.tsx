import type { Tone } from "../utils/status";

interface StatusBadgeProps {
  label: string;
  tone: Tone;
}

function StatusBadge({ label, tone }: StatusBadgeProps) {
  return <span className={`badge ${tone}`}>{label}</span>;
}

export default StatusBadge;
