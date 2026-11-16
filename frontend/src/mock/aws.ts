import type { AwsAccount, Ec2Instance } from "../types/Aws";
import type { MetricPoint } from "../types/Dashboard";

export const awsAccount: AwsAccount = {
  accountId: "123456789012",
  userName: "cloudopshub-service",
  arn: "arn:aws:iam::123456789012:user/cloudopshub-service",
};

export const ec2Instances: Ec2Instance[] = [
  {
    instanceId: "i-0abc123def4567890",
    name: "web-01",
    state: "running",
    instanceType: "t3.micro",
    availabilityZone: "us-east-1a",
    privateIp: "172.31.20.15",
    launchTime: "2026-11-10T22:14:03+00:00",
  },
  {
    instanceId: "i-0def456abc7890123",
    name: "api-01",
    state: "running",
    instanceType: "t3.small",
    availabilityZone: "us-east-1b",
    privateIp: "172.31.34.120",
    launchTime: "2026-11-02T09:41:55+00:00",
  },
  {
    instanceId: "i-0987fedcba6543210",
    name: "batch-worker",
    state: "stopped",
    instanceType: "t3.medium",
    availabilityZone: "us-east-1a",
    privateIp: null,
    launchTime: "2026-10-21T15:03:12+00:00",
  },
];

// Mock CloudWatch CPU: one point every 5 minutes for `hours`, shaped like the real endpoint.
// Deterministic per instance so the chart doesn't jump around on every render.
export function mockEc2Cpu(instanceId: string, hours: number): MetricPoint[] {
  const instance = ec2Instances.find((i) => i.instanceId === instanceId);
  if (!instance || instance.state !== "running") return [];

  const seed = [...instanceId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const base = 15 + (seed % 30);
  const end = new Date();
  end.setMinutes(end.getMinutes() - (end.getMinutes() % 5), 0, 0);

  const points: MetricPoint[] = [];
  for (let i = hours * 12 - 1; i >= 0; i--) {
    const t = new Date(end.getTime() - i * 5 * 60_000);
    const wave = Math.sin((i + seed) / 6) * 12 + Math.sin((i * 7 + seed) / 3) * 4;
    const value = Math.min(100, Math.max(0, base + wave));
    points.push({
      timestamp: t.toTimeString().slice(0, 5),
      value: Math.round(value * 10) / 10,
    });
  }
  return points;
}
