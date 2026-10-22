# Terraform (planned)

Infrastructure as Code for deploying CloudOps Hub to the cloud.

**Not started yet.** Waiting on the team decision below.

## Open decisions

- [ ] Cloud provider: AWS or Azure (the dashboard already models both account types)
- [ ] Hosting model: containers (ECS Fargate / Azure Container Apps) vs VMs
- [ ] Remote state backend (S3 + DynamoDB / Azure Storage)

## Suggested layout once decided

```
terraform/
├── modules/          Reusable pieces (network, container service, database)
├── envs/
│   ├── dev/
│   └── prod/
└── README.md
```

Never commit `*.tfstate` or `*.tfvars` with secrets; they are already in `.gitignore`.
