// Live AWS data (account identity, EC2 inventory, CloudWatch CPU).
// The backend requires a signed-in user for every /aws/* call.

import { awsAccount, ec2Instances, mockEc2Cpu } from "../mock/aws";
import type { AwsAccount, Ec2Instance } from "../types/Aws";
import type { MetricPoint } from "../types/Dashboard";
import { apiClient, USE_MOCK } from "./apiClient";

export async function getAwsAccount(): Promise<AwsAccount> {
  if (USE_MOCK) return awsAccount;
  const res = await apiClient.get<AwsAccount>("/aws/account");
  return res.data;
}

export async function getEc2Instances(): Promise<Ec2Instance[]> {
  if (USE_MOCK) return ec2Instances;
  const res = await apiClient.get<Ec2Instance[]>("/aws/ec2");
  return res.data;
}

// CloudWatch can be slow, so this call gets a longer timeout than the default 5s.
export async function getEc2Cpu(instanceId: string, hours: number): Promise<MetricPoint[]> {
  if (USE_MOCK) return mockEc2Cpu(instanceId, hours);
  const res = await apiClient.get<MetricPoint[]>(`/aws/ec2/${encodeURIComponent(instanceId)}/cpu`, {
    params: { hours },
    timeout: 15000,
  });
  return res.data;
}
