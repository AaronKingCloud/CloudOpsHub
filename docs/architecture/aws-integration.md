# AWS Integration

How the backend talks to AWS, what permissions it needs, and known account limitations.

## Credentials

The backend uses the standard boto3 credential chain. Locally, use a **named profile**,
not `default`, so Learner Lab credentials for other courses don't overwrite it:

```bash
aws configure --profile cloudopshub
```

```powershell
$env:AWS_PROFILE = "cloudopshub"   # set before `fastapi dev app/main.py`
```

Never commit credentials. `~/.aws/` lives outside the repo.

## Least-privilege IAM policy

The `cloudopshub-service` IAM user has only this inline policy (`CloudOpsHubReadOnly`):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "sts:GetCallerIdentity",
      "ec2:DescribeInstances",
      "cloudwatch:GetMetricStatistics"
    ],
    "Resource": "*"
  }]
}
```

Add actions here when new endpoints need them, and update this doc in the same PR.

### Deployed app (instance role)

In AWS the backend uses no access keys. The EC2 instance role from `infra/terraform/modules/iam`
(`cloudopshub-dev-instance`) allows exactly these actions, which include the two Cost Explorer
actions the cost panel needs:

```json
[
  "sts:GetCallerIdentity",
  "ec2:DescribeInstances",
  "cloudwatch:GetMetricStatistics",
  "ce:GetCostAndUsage",
  "ce:GetCostForecast"
]
```

plus `ssm:GetParameter` on the JWT secret only. To change the app's permissions, edit
`modules/iam/main.tf` and this section in the same PR.

Verified 2026-11-11: CloudWatch allowed; `s3 ls` denied ("no identity-based policy allows").

## Known limitation: single-region projects (AWS Settings / Builder ID accounts)

> **Correction (2026-11-20):** an earlier version of this section blamed the AWS **Free plan**.
> Upgrading the plan did not help; the real cause is the Region restriction below.

Accounts created through **AWS Settings** (Projects / Team, signed in with an AWS Builder ID) are
member accounts in an AWS-managed organization. A guardrail SCP denies EC2 in every Region except
the project's **home Region**, for every caller, including the console's own full-access role.

Symptom: `UnauthorizedOperation ... explicit deny in a service control policy`.

How we found it: tested `ec2 describe-instances` in 8 Regions from CloudShell; only us-east-2 worked.

Fix: use the project's home Region everywhere (CLI profiles, Terraform, the deployed backend):

```bash
aws configure set region us-east-2 --profile cloudopshub   # Console Dot Dream = us-east-2
```

- Upgrading the billing plan does **not** remove the guardrail. Activating "advanced features"
  would, but that is irreversible and deletes the project's spend limit.
- Each monitored account may have a different home Region, so the multi-account design (below)
  must store a **Region per account**.

## Team decision needed: which accounts do we monitor, and how?

The dashboard is meant to show multiple accounts. Proposed approach, the same pattern
commercial monitoring tools use:

1. Each monitored account gets a read-only IAM **role** (e.g. `CloudOpsHubReadOnly`)
   that trusts the CloudOps Hub account.
2. The backend calls `sts:AssumeRole` per account to get short-lived credentials.
3. No long-lived access keys per account.

Open questions:
- Which AWS accounts are we using (Free plan, paid, Learner Lab)?
  Learner Lab credentials expire every session.
- Who owns and administers the CloudOps Hub account?