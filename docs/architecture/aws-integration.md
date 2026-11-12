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

Verified 2026-11-11: CloudWatch allowed; `s3 ls` denied ("no identity-based policy allows").

## Known limitation: AWS Free plan accounts

On an account using AWS's **Free plan**, `ec2:DescribeInstances` from the service user's
access key fails with:

> explicit deny in a service control policy

The SCP is AWS-managed (Organizations, Policy Simulator, etc. show "Available with advanced
features"). Console access to EC2 still works. IAM changes cannot override it.

Options: upgrade the account plan, or use an account that allows programmatic EC2 access.

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