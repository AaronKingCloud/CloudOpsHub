import { useAuth } from "../hooks/useAuth";

export default function RoleBanner() {
  const { user } = useAuth();
  if (!user) return null;

  const roleDescriptions: Record<string, { title: string; desc: string }> = {
    admin: {
      title: "Administrator Access",
      desc: "Full privileges enabled: User administration, infrastructure config, cloud security policies, and incident mitigation.",
    },
    operator: {
      title: "Operator Access",
      desc: "Operational privileges enabled: Device triage, alert acknowledgments, and runtime telemetry inspection.",
    },
    viewer: {
      title: "Viewer Access",
      desc: "Read-only access: Monitoring dashboards and system health telemetry are active in view-only mode.",
    },
  };

  const info = roleDescriptions[user.role] ?? {
    title: `${user.role} mode`,
    desc: "Active role session.",
  };

  return (
    <div className={`role-banner role-${user.role}`}>
      <span className="role-banner-title">{info.title}</span> — {info.desc}
    </div>
  );
}
