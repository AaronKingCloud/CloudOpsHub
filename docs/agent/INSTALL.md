# Installing the CloudOps Hub Agent

The agent is a small Python program that runs on each device you want to monitor (a server, VM,
NAS, Raspberry Pi…). Every minute it sends CPU, memory, disk and uptime to CloudOps Hub, which
updates the dashboard and raises alerts (offline, disk nearly full, high CPU or memory).

> **Status:** Both the dashboard setup screen and the agent (`agent/cloudops_agent.py` +
> `POST /api/agent/metrics`) are implemented. Follow the steps below to connect any Linux,
> macOS, or Windows host.

## 1. Add the device in CloudOps Hub

1. Sign in as an **admin**.
2. Go to **Devices → + Add device**, enter the hostname (e.g. `nas-01`), type and, optionally, IP address.
3. You land on the device's page. Under **Connect the agent**, **copy the agent key now**.
   It's shown once and can't be read back. If it's lost, an admin can click
   **Generate a new key** (the old key stops working).

## 2. Install the agent on the device

Needs Python 3.10 or newer.

**Linux / macOS**

```bash
python3 -m pip install --user psutil requests
curl -O https://raw.githubusercontent.com/AaronKingCloud/CloudOpsHub/main/agent/cloudops_agent.py
python3 cloudops_agent.py --server https://<your-cloudops-hub>/api --key coa_<your-key>
```

**Windows (PowerShell)**

```powershell
py -m pip install psutil requests
Invoke-WebRequest https://raw.githubusercontent.com/AaronKingCloud/CloudOpsHub/main/agent/cloudops_agent.py -OutFile cloudops_agent.py
py cloudops_agent.py --server https://<your-cloudops-hub>/api --key coa_<your-key>
```

The device page shows the exact command with your server address and key filled in, with a copy button.

Within a minute the device turns **Online** and its numbers appear.

## 3. Keep it running

Run it as a service so it survives reboots.

**Linux (systemd):** create `/etc/systemd/system/cloudops-agent.service`:

```ini
[Unit]
Description=CloudOps Hub agent
After=network-online.target

[Service]
ExecStart=/usr/bin/python3 /opt/cloudops/cloudops_agent.py --server https://<your-cloudops-hub>/api --key-file /opt/cloudops/agent.key
Restart=always
User=cloudops

[Install]
WantedBy=multi-user.target
```

Then `sudo systemctl enable --now cloudops-agent`. Keeping the key in a file readable only by the
`cloudops` user (`chmod 600`) keeps it out of `ps` output.

**Windows:** use Task Scheduler → "At startup", or a service wrapper such as NSSM.

## Troubleshooting

| What you see | Likely cause | Fix |
| --- | --- | --- |
| Device stays **Offline** | Agent not running, or can't reach the server | Run the command by hand and read its output; check the `--server` URL opens in a browser on that device |
| Agent prints `401` | Wrong or replaced key | Copy the key again, or generate a new one on the device page |
| Device flips offline at times | Network drops; 3 missed reports (3 min) mark it offline | Check the device's connection; it turns online at the next report |

## Security

- The agent only **sends** numbers; it opens no ports and accepts no commands.
- Each device has its own key, so one leaked key can't report for other devices. Replace a leaked key
  with **Generate a new key**.
- Use `https://` for the server address once HTTPS is set up (task A5), so the key isn't sent in clear text.
