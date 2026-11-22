"""Response models matching docs/api/frontend-contract.md.

Fields are snake_case in Python and serialized as camelCase in JSON
(e.g. ``online_devices`` -> ``onlineDevices``) so the frontend types match.
If you change a model here, update the contract and frontend/src/types/ too.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class DashboardSummary(CamelModel):
    online_devices: int
    offline_devices: int
    active_alerts: int
    total_devices: int


DeviceType = Literal["server", "vm", "container", "nas", "service"]


class Device(CamelModel):
    id: int
    hostname: str
    status: Literal["online", "offline"]
    cpu: int = Field(ge=0, le=100)
    memory: int = Field(ge=0, le=100)
    storage: int = Field(ge=0, le=100)
    type: DeviceType = "server"
    ip_address: str | None = None
    description: str | None = None
    last_seen: str | None = None


class DeviceInput(CamelModel):
    hostname: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    type: DeviceType = "server"
    ip_address: str | None = Field(default=None, max_length=64)
    description: str | None = Field(default=None, max_length=1000)


class AgentKeyResponse(CamelModel):
    agent_key: str


class DeviceCreateResponse(CamelModel):
    device: Device
    agent_key: str


class MetricPoint(CamelModel):
    timestamp: str
    value: float


AlertStatus = Literal["open", "acknowledged", "resolved"]


class Alert(CamelModel):
    id: int
    severity: Literal["info", "warning", "critical"]
    message: str
    device_id: int | None = None
    status: AlertStatus = "open"
    created_at: str | None = None
    acknowledged_by: str | None = None
    resolved_at: str | None = None


class Account(CamelModel):
    id: int
    provider: str
    account_name: str
    status: Literal["Healthy", "Warning", "Critical"]
    alert_count: int
    last_updated: str

class AwsAccount(CamelModel):
    account_id: str
    user_name: str
    arn: str

# Additional models for AWS EC2 instances
class Ec2Instance(CamelModel):
    instance_id: str
    name: str
    state: str
    instance_type: str
    availability_zone: str
    private_ip: str | None = None
    launch_time: str


class ServiceCost(CamelModel):
    service: str
    amount: float
    currency: str = "USD"
    percentage: float


class BillingSummary(CamelModel):
    current_month_spend: float
    forecasted_spend: float
    currency: str = "USD"
    period_start: str
    period_end: str
    service_breakdown: list[ServiceCost]
    source: Literal["aws", "mock"]


class AgentMetricReport(CamelModel):
    cpu: float = Field(ge=0, le=100)
    memory: float = Field(ge=0, le=100)
    storage: float = Field(ge=0, le=100)
    uptime_seconds: float | None = Field(default=None, ge=0)
