Frontend API Contract
Dashboard Summary
Example
{
  "onlineDevices": 15,
  "offlineDevices": 2,
  "activeAlerts": 3,
  "totalDevices": 17
}
Devices Endpoint
GET /devices

[
  {
    "id": 1,
    "hostname": "plex-server",
    "status": "online",
    "cpu": 25,
    "memory": 48,
    "storage": 62
  }
]
CPU Metrics Endpoint
GET /metrics/cpu

[
  {
    "timestamp": "10:00",
    "value": 25
  }
]
Alerts Endpoint
GET /alerts

[
  {
    "id": 1,
    "severity": "critical",
    "message": "Storage exceeds 90%"
  }
]