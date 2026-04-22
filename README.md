
# pinfinity

> [!NOTE]
> This project's code and documentation was partially developed with the assistance of GitHub Copilot and Claude Code

As Joola decided to no longer support their Infinity table tennis robots, pinfinity is a self-hosted replacement for the Joola cloud backend. It reimplements the API the Joola app talks to and includes a custom web frontend that controls the robot directly via Bluetooth.

**What works:**
- Training sessions (basic and advanced) — create, modify, and delete
- The app ships with all default trainings pre-loaded

**What does not work:**
- Social features (tutorials, etc.)
- More than one robot per instance
- Fine-tuning of robot settings that are not yet reverse-engineered

> The Joola app may show occasional error messages — these can safely be ignored. See [Troubleshooting](docs/deployment.md#troubleshooting) if the app behaves unexpectedly.

---

## Usage Modes

There are three ways to use pinfinity. Choose the one that fits your setup:

### Option A — Android App + Docker (full setup)

Use the **original Joola Android app** alongside the pinfinity Docker container. The app handles everything — training selection, robot control — as if the Joola servers were still online.

**Requires:**
- Patching the Joola APK to remove certificate pinning (one-time, uses `apk-mitm`)
- Installing a self-signed CA certificate on your Android device
- A DNS redirect pointing `api-v6.admin.joola.com` to your server
- A host running Docker Compose (a Raspberry Pi is sufficient)

→ [Full setup guide](docs/deployment.md)

---

### Option B — Web Frontend + Docker

Use the **custom web frontend** (built into pinfinity) instead of the Joola app. Works in any modern browser that supports the Web Bluetooth API (Chrome/Chromium on Android).

**Requires:**
- A self-signed TLS certificate (so HTTPS is served — required for Web Bluetooth)
- Installing the CA certificate on your Android device
- A host running Docker Compose
- No APK patching needed

→ [Full setup guide](docs/deployment.md) (skip the APK patching steps)

---

### Option C — Local (PC / development)

Run pinfinity **directly on your PC** without Docker or certificates. Open the web frontend in Chrome and connect to the robot via Bluetooth. Ideal for development or quick testing.

**Requires:**
- Python 3.11+
- A Bluetooth adapter in your PC

```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Open in Chrome
# http://localhost:8000
```

No certificates needed — the browser allows Web Bluetooth over plain HTTP on `localhost`.

---

## Documentation

| Document | Description |
|---|---|
| [Deployment Guide](docs/deployment.md) | Docker setup, certificates, DNS, environment variables |
| [Simulator](docs/simulator.md) | Run a virtual robot on a Raspberry Pi for development |
| [Bluetooth Protocol](docs/bluetooth_protocol.md) | Reverse-engineered BLE protocol reference |
