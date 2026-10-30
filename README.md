# CloudOps Hub

CloudOps Hub is a cloud-native infrastructure monitoring and
operations platform designed for homelab enthusiasts, power users,
and small businesses.

The platform provides centralized infrastructure visibility,
monitoring, alerting, asset management, and operational insights
through a unified interface.

## Project Status

🛠️ Proof of Concept / Development Phase

CloudOps Hub is currently being developed as a capstone project
for the Cloud Architecture and Administration program at Seneca.

👉 See [`docs/PROGRESS.md`](docs/PROGRESS.md) for what has been done,
what is in progress, and what is next.

👉 See [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to set up the
project and how we use branches and pull requests.

## Repository Structure

```
CloudOpsHub/
├── frontend/          React + TypeScript dashboard (Vite)
├── backend/           REST API (Python / FastAPI)
├── infra/             Docker, docker-compose, and future Terraform
├── .github/workflows/ CI pipelines (GitHub Actions)
└── docs/
    ├── api/           API contract shared by frontend and backend
    ├── architecture/  Design documents
    ├── planning/      Risk register, SWOT, mind map, workflow
    └── PROGRESS.md    Running log of team progress
```

Each top-level folder has its own `README.md` explaining how to run it.

## Quick Start

```bash
# Frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

```bash
# Backend (http://localhost:8000/docs)
cd backend
python -m venv .venv
.venv\Scripts\activate         # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
fastapi dev app/main.py
```

```bash
# Everything in Docker (frontend http://localhost:8080)
cd infra
docker compose up --build
```

More detail in each folder's `README.md` and in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Objectives

- Centralize infrastructure monitoring
- Provide asset and service visibility
- Generate configurable operational alerts
- Implement secure cloud architecture
- Automate infrastructure deployment
- Implement CI/CD practices
- Design for scalability and resiliency
- Apply cloud well-architected principles

## Planned Capabilities

### Monitoring

- CPU utilization
- Memory utilization
- Disk utilization
- Uptime
- Service health

### Asset Management

- Servers
- Virtual machines
- Containers
- NAS devices
- Services

### Alerting

- Device offline
- Resource threshold exceeded
- Storage capacity warnings
- Service failures

## Target Users

CloudOps Hub is designed around a tiered model:

### Homelab

Infrastructure monitoring for self-hosted environments.

### Pro

Advanced monitoring, historical reporting, backup visibility,
and security insights.

### Business

Team access, RBAC, governance, cloud integrations, and advanced
operational visibility.

## Architecture

Architecture documentation is available in:

`docs/architecture/`

## Project Documentation

Project planning documentation can be found in:

`docs/planning/`

## Technology Stack

| Layer          | Technology                                   |
| -------------- | -------------------------------------------- |
| Frontend       | React 19, TypeScript, Vite, Recharts, Axios  |
| Backend        | Python, FastAPI                              |
| Containers     | Docker, docker-compose                       |
| CI/CD          | GitHub Actions                               |
| Infrastructure | Terraform (planned), cloud provider TBD      |

## AWS Integration

CloudOps Hub now includes initial AWS integration through a dedicated IAM
service account and FastAPI endpoint.

### Current AWS Features

- IAM service account (`cloudopshub-service`)
- AWS SDK for Python (boto3) integration
- Live AWS account information retrieval
- FastAPI AWS endpoint documentation through Swagger/OpenAPI

### Available Endpoint

```http
GET /api/aws/account

## Roadmap

- [x] Project concept
- [x] Scope statement
- [x] Project charter
- [x] Risk register
- [x] SWOT analysis
- [x] Initial AWS IAM integration
- [x] Live AWS account endpoint
- [ ] Monitoring and observability
- [ ] Security validation
- [ ] Requirements specification
- [ ] Architecture design
- [ ] Proof of concept
- [ ] Infrastructure as Code
- [ ] CI/CD
- [ ] MVP deployment
- [ ] Monitoring and observability
- [ ] Security validation
- [ ] Disaster recovery testing

## Disclaimer

This project is currently under active development as an
academic capstone and independent portfolio project.
