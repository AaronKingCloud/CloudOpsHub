# CloudOps Hub — End-to-End Demo Script (F1)

The team session that proves the MVP works on the **live cloud site**, and the outline for the demo video (F2).
Each step names the requirement it proves (`docs/requirements/REQUIREMENTS.md`). Fill in the results table at the end.

**Site:** https://drk4col17f8z3.cloudfront.net · **Time:** ~30 minutes · Draft by Aaron, 2026-11-22

| Role | Who | Does |
| --- | --- | --- |
| Driver: dashboard | Tirth | Signs in, clicks through the screens, acknowledges alerts |
| Driver: device | pshrestha49 | Runs the agent on the Linux machine, stops and restarts it |
| Driver: cloud | Aaron | HTTPS, deploys, monitoring, measurements; keeps the results table |

> Swap roles freely. The point is that everyone sees each part work.

---

## Before the session (Aaron, ~10 min)

- [ ] All PRs merged in order (#50 → #51 → #52 → README → this one, plus #47) and the last **Deploy** run is green
- [ ] Site loads for everyone: each person sends their public IP (`(Invoke-RestMethod https://checkip.amazonaws.com).Trim()`);
      add it to `allowed_cidrs` in `terraform.tfvars` and `terraform apply` (~1 min, no rebuild)
- [ ] Everyone confirmed the **AWS Notification** subscription email (or nobody gets alarm emails)
- [ ] The Linux machine is ready (WSL Ubuntu on a laptop is fine; its traffic uses that laptop's allowed IP) with Python 3.10+
- [ ] Chrome, Edge and Firefox installed on at least one laptop
- [ ] Screen recording on (OBS / Xbox Game Bar `Win+Alt+R`); this becomes the demo video (F2)
- [ ] Demo passwords at hand (`backend/seed.py`); set `DEMO_PASSWORD` in the terminal for the measurement script

---

## Part 1 — Sign in and roles (Tirth, 3 min)

| # | Do | Expect | Proves |
| --- | --- | --- | --- |
| 1.1 | Open `http://drk4col17f8z3.cloudfront.net` (note: **http**) | Browser ends up on **https://**, padlock shown | NFR-S1 |
| 1.2 | Open the site in a private window without signing in | Sent to sign-in; no data visible | FR-4 |
| 1.3 | Sign in as **viewer** | Dashboard visible; no Add / Edit / Acknowledge buttons | FR-1, FR-2, FR-5 |
| 1.4 | Sign out, sign in as **admin** | Users page and device actions appear | FR-3, FR-5 |

## Part 2 — Connect a real device (pshrestha49 + Tirth, 5 min)

| # | Do | Expect | Proves |
| --- | --- | --- | --- |
| 2.1 | Admin: **Devices → + Add device**, hostname `demo-homelab`, type **VM** | Device page opens; **agent key shown once** | FR-8 |
| 2.2 | Copy the command from **Connect the agent** (it already has the HTTPS address and key) | — | C4 |
| 2.3 | On the Linux machine (Ubuntu 24.04 blocks system-wide `pip`, so use a venv): | | NFR-U3 |

```bash
python3 -m venv ~/cloudops-agent && ~/cloudops-agent/bin/pip install psutil requests
curl -O https://raw.githubusercontent.com/AaronKingCloud/CloudOpsHub/main/agent/cloudops_agent.py
~/cloudops-agent/bin/python cloudops_agent.py --server https://drk4col17f8z3.cloudfront.net/api --key coa_<key>
```

| # | Do | Expect | Proves |
| --- | --- | --- | --- |
| 2.4 | Start a stopwatch when the agent starts; refresh the device page | **Online** with real CPU / memory / storage / last seen; note the seconds: ____ (target ≤ 90 s) | FR-9, FR-11, NFR-P4 |
| 2.5 | Overview page | Device counted as online; charts include it | FR-13 |
| 2.6 | Leave it running ~5 min (do Part 4 meanwhile), then open the device's history charts | Points every minute | FR-10, FR-12 |

## Part 3 — Alerts (pshrestha49 + Tirth, 6 min)

| # | Do | Expect | Proves |
| --- | --- | --- | --- |
| 3.1 | **Stop the agent** (`Ctrl+C`) and start a stopwatch | After ~3 min: device **Offline** and a **critical "device offline"** alert; note the minutes: ____ | FR-15, FR-17 |
| 3.2 | Sign in as **operator** → Alerts → **Acknowledge** | Alert marked acknowledged, who and when | FR-18 |
| 3.3 | Restart the agent | Device back **Online**; the alert **resolves by itself** and stays in history | FR-17, FR-18 |
| 3.4 | *(Optional)* Make the CPU busy: `python3 -c "while True: pass"` in 2–3 terminals for 3 min | CPU warning (> 70 %) or critical (> 90 %) alert; stop the loops → resolves | FR-16 |

## Part 4 — The cloud side (Aaron, 8 min)

| # | Do | Expect | Proves |
| --- | --- | --- | --- |
| 4.1 | **AWS Cloud** page | Account, EC2 instances with CPU chart, month cost + forecast | FR-20–FR-23 |
| 4.2 | Show the architecture diagram (README) and `infra/terraform/` | Everything created by Terraform; state in S3 | NFR-M3 |
| 4.3 | **Live deploy:** merge a small visible change (e.g. Tirth's PR changing a page title) → **Actions → Deploy** | Run goes green in a few minutes; refresh: change is live | NFR-M4 |
| 4.4 | Explain the rollback: show the "rolled back" test in `docs/PROGRESS.md` (A4) | A broken deploy keeps the old version running | NFR-A5 |
| 4.5 | Show **GitHub → Settings → Secrets**: no AWS keys; show the OIDC role in `modules/iam` | No long-lived keys anywhere | NFR-S5 |
| 4.6 | Show CloudWatch: log groups, the 3 alarms, the alarm email from the A6 test | Logs + email within ~4 min | NFR-A4 |
| 4.7 | Show the budget ($10/month, emails at $5 / $10) and the SonarCloud Quality Gate on a PR | Cost and code quality guarded | NFR-C1, NFR-M5 |

## Part 5 — Measurements (Aaron, 8 min)

| # | Do | Expect | Proves |
| --- | --- | --- | --- |
| 5.1 | Chrome: **F12 → Network**, tick *Disable cache*, reload the Overview; read **Load** at the bottom | ≤ 3 s; result: ____ s | NFR-P1 |
| 5.2 | `python infra/scripts/demo_check.py latency --url https://drk4col17f8z3.cloudfront.net` | worst p95 ≤ 500 ms; result: ____ ms | NFR-P2 |
| 5.3 | `python infra/scripts/demo_check.py simulate --url https://drk4col17f8z3.cloudfront.net --devices 20 --minutes 5` | 20 simulated devices, 0 failed reports, new reading visible ≤ 90 s; cleans up after itself | NFR-P3, NFR-P4 |
| 5.4 | Open the site, sign in and view a device in **Chrome, Edge and Firefox**, and on a phone (phone needs its IP allowed, or use the same Wi-Fi) | Works in all | NFR-U1, NFR-U1b |

> 5.3 creates `demo-sim-01`…`20` for 5 minutes. They may raise offline alerts once the simulation stops;
> the script deletes them (and their alerts) at the end.

---

## Results (fill in during the session)

| Requirement | Result | Pass? |
| --- | --- | --- |
| NFR-S1 HTTPS + redirect | | |
| FR-1–FR-5 sign-in and roles | | |
| FR-8–FR-13 device, agent, data, charts | | |
| NFR-P4 new reading visible | ____ s | |
| FR-15–FR-18 offline alert, acknowledge, auto-resolve | offline after ____ min | |
| FR-16 threshold alert (optional) | | |
| FR-20–FR-23 AWS page | | |
| NFR-M4 deploy on merge | ____ min from merge to live | |
| NFR-P1 page load | ____ s | |
| NFR-P2 API p95 | ____ ms | |
| NFR-P3 20 devices | ____ ok / ____ failed | |
| NFR-U1b browsers | Chrome / Edge / Firefox | |

## After the session

- [ ] Stop the agent; keep `demo-homelab` if you want it in the final demo, or delete it
- [ ] Add a `docs/PROGRESS.md` entry with the results table; mark **F1** done in `docs/REMAINING_WORK.md`
- [ ] Update the requirement statuses in `docs/REQUIREMENTS.md` that this proved
- [ ] Remove anyone's temporary IP from `allowed_cidrs` that shouldn't stay

## If something goes wrong

| Problem | Fix |
| --- | --- |
| Site shows "limited to approved networks" (403) | That person's IP isn't in `allowed_cidrs`; add it and `terraform apply` |
| Agent prints `401` | Wrong or replaced key; copy it again from the device page or generate a new one |
| Device stays Offline | Agent can't reach the site: on that machine run `curl -sI https://drk4col17f8z3.cloudfront.net` (200 = fine, 403 = its IP isn't allowed) |
| Site down / alarm email | Runbook in `infra/terraform/README.md` → Monitoring |
| Deploy run red | It rolled back, so the site still works; read the run's **Deploy on the server** step output |
