import type { Tone } from "../utils/status";

interface StatCardProps {
  label: string;
  value: number | string;
  tone?: Tone;
}

function StatCard({ label, value, tone }: StatCardProps) {
  return (
    <div className={`stat-card ${tone ?? ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default StatCard;
