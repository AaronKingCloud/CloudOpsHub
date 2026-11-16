// Types for the live AWS endpoints. Match AwsAccount / Ec2Instance in backend/app/schemas.py
// and the "AWS (live)" section of docs/api/frontend-contract.md.

export interface AwsAccount {
  accountId: string;
  userName: string;
  arn: string;
}

// Common EC2 states; the API may return others (e.g. "shutting-down").
export type Ec2State = "pending" | "running" | "stopping" | "stopped" | "shutting-down" | "terminated";

export interface Ec2Instance {
  instanceId: string;
  name: string;
  state: Ec2State | string;
  instanceType: string;
  availabilityZone: string;
  privateIp: string | null;
  launchTime: string;
}
