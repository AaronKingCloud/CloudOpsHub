"""Response models matching docs/api/frontend-contract.md.

Fields are snake_case in Python and serialized as camelCase in JSON
(e.g. ``online_devices`` -> ``onlineDevices``) so the frontend types match.
If you change a model here, update the contract and frontend/src/types/ too.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class DashboardSummary(CamelModel):
    online_devices: int
    offline_devices: int
    active_alerts: int
    total_devices: int


class Device(CamelModel):
    id: int
    hostname: str
    status: Literal["online", "offline"]
    cpu: int = Field(ge=0, le=100)
    memory: int = Field(ge=0, le=100)
    storage: int = Field(ge=0, le=100)


class MetricPoint(CamelModel):
    timestamp: str
    value: float


class Alert(CamelModel):
    id: int
    severity: Literal["info", "warning", "critical"]
    message: str


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