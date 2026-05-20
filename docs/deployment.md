# pinfinity — Deployment Guide

This guide covers the full Docker-based deployment (Options A and B from the [README](../README.md)).

For a local development setup without Docker, see [Option C in the README](../README.md#option-c--local-pc--development).

---

## Requirements

- A host with Docker Compose (a Raspberry Pi 3/4/5 is sufficient)
- Port 443 available on the host
- An Android device with Chrome (for the web frontend) or the Joola app (≤ 2.2.1)
- A way to redirect DNS: your router, PiHole, AdGuard Home, etc.

---

## Step 1 — Patch the Joola APK (Option A only)

> Skip this step if you are using the web frontend (Option B).

The Joola app uses certificate pinning, which prevents it from trusting our self-signed certificate. You need to patch it once:

1. Create a backup of your Joola Infinity app using [SAI](https://github.com/Aefyr/SAI) on your Android device. This produces a `*.apks` file — **keep this file in a safe place**.
2. Copy the `*.apks` to your computer and patch it with [apk-mitm](https://github.com/niklashigi/apk-mitm):
   ```bash
   apk-mitm your-joola-backup.apks
   ```
3. Copy the patched `*.apks` back to your Android device, uninstall the original Joola app, and install the patched version using [SAI](https://github.com/Aefyr/SAI).

---

## Step 2 — Generate TLS Certificates

TLS certificates are required for both Option A and Option B. The compose helper `docker-compose-certs.yaml` generates a self-signed certificate and CA.

```bash
# Generate certs (creates ./certs/cert.pem, ./certs/key.pem, ./certs/ca.pem)
docker compose -f ./docker-compose-certs.yaml up -d --remove-orphans

# Wait until the container finishes
docker compose -f ./docker-compose-certs.yaml logs --no-follow
```

Verify that `./certs/` contains `cert.pem`, `key.pem`, and `ca.pem` before continuing.

---

## Step 3 — Trust the CA Certificate on Android

Copy `./certs/ca.pem` to your Android device and install it as a trusted CA:

1. Open **Settings** → **Security & privacy** → **More security settings** → **Encryption & credentials**
2. Tap **Install a certificate** → **CA certificate**
3. Select the `ca.pem` file

> This step is required for both the Joola app (Option A) and the web frontend (Option B) to accept the self-signed certificate.

---

## Step 4 — Configure Environment Variables (Option A only)

> **Option B (web frontend):** Skip this step. All variables below are only consumed by the Joola app. `LOG_LEVEL` defaults to `WARNING` if unset.

Open `docker-compose.yaml` and fill in the environment variables for the `pinfinity` service:

| Variable | Description |
|---|---|
| `PINFINITY_NAME` | Your display name from the Joola app (shown on the "More" tab) |
| `PINFINITY_EMAIL` | Your email address from your Joola profile |
| `PINFINITY_DEVICE_NAME` | Any name you want to give your robot |
| `PINFINITY_DEVICE_ID` | Found by scanning the barcode on the back of the robot in the app |
| `PINFINITY_SERIAL_NUMBER` | Found by scanning the barcode on the back of the robot in the app |
| `LOG_LEVEL` | Optional. Set to `DEBUG` to enable logging. Defaults to `WARNING`. |

Replace all `"XXX"` placeholders with real values.

---

## Step 5 — Start the Stack

```bash
docker compose -f ./docker-compose.yaml up -d --build
```

This starts the `pinfinity` API server and an `nginx` reverse proxy on port 443. On first run, `./pinfinity/` is created and seeded with the default training data.

---

## Step 6 — Redirect DNS

Configure your router, PiHole, AdGuard Home, or similar to resolve `api-v6.admin.joola.com` to the IP address of your host running pinfinity.

This step is required for both options, but for different reasons:

- **Option A:** The Joola app has `api-v6.admin.joola.com` hardcoded — the redirect makes it talk to pinfinity instead of the Joola servers.
- **Option B:** The TLS certificate is issued for `api-v6.admin.joola.com`. Accessing the server by IP address causes a hostname mismatch, which prevents HTTPS from working — and Web Bluetooth requires a secure HTTPS context. Opening `https://api-v6.admin.joola.com` in the browser resolves this.

Once the DNS redirect is active:
- **Option A:** Open the Joola app — it will connect to your pinfinity instance.
- **Option B:** Open `https://api-v6.admin.joola.com` in Chrome on your Android device.

---

## Updates

All user data (including custom trainings) is stored in `./pinfinity/`. Back up `advance-list.json` and `basic-list.json` before updating — these contain your custom trainings. All other files are static and do not need to be backed up.

You can also download both files as a zip via:
```
https://api-v6.admin.joola.com/api/download/lists
```
(Ignore the certificate warning in the browser.)

---

## Useful Commands

```bash
# Start (build + run)
docker compose -f ./docker-compose.yaml up -d --build

# Stop
docker compose -f ./docker-compose.yaml down

# Show logs
docker compose -f ./docker-compose.yaml logs -f

# Regenerate certificates
docker compose -f ./docker-compose-certs.yaml up -d

# Open a shell in the container
docker exec -it pinfinity /bin/sh
```

---

## Troubleshooting

**Port 443 already in use** — Stop any other service using port 443, or put pinfinity behind an existing reverse proxy.

**Missing `./certs/cert.pem` or `./certs/key.pem`** — Run the certificate generation step again (Step 2).

**Joola app shows errors** — Some error messages are expected and can be ignored. If the app behaves erratically on startup, press the home button without closing the app, then reopen it. Locking and unlocking the screen also helps.

**Joola app crashes when switching tabs** — Only use the `Play` and `More` tabs. Other tabs may cause the app to crash.

If you encounter an issue not listed here, check the container logs (`docker compose logs`) and open an issue with the relevant output.
