
# pinfinity — Deployment Guide

> [!NOTE]
> This project's code and documentation was partially developed with the assistance of GitHub Copilot

As Joola decided to not longer support their infinity table tennis robots, I built a small app to still use the robot after the shutdown of the Joola server. It is a bit complicated to set up and we need to work around some restrictions.

What can you expect after the successful installation:
- The roboter will work again!
- Trainings (basic and advanced) can be created, modified and deleted (the app comes prebundeled with the default trainings).

What will not work:
- Any "Social" feature, like tutorials etc.
- More then one robot connected to the Joola app.
- Fine tuning of the robot settigs.
- In case you need a specific function that is not yet implemented, feel free to open an issue!

What should be considered:
- The Joola app will show some random error messages, but they can be ignored.
- The startup of the Joola app is sometimes a bit bumpy. If this is the case, just switch to your home screen without closing the app and open it again. Or lock your screen and unlock it again.
- Please don't switch to other tabs then `Play`and `More`, as it can crash the Joola app.
- If something is not implemented, the Joola app can show "Saved" but the change is not really saved.

## Requirements

- An Android Device with the installed Joola App (The App version must be compatible with the Robot, so 2.2.1 or lower).
- A method to modify the routing of the Joola domain. Could be done perhaps in your network router or otherwise by using e.g. PiHole or AdGuard Home.
- A host with Docker Compose, a Raspberry Pi is powerful enough.
- The pinfinity app must run on port 443.

## Installation process

As the Joola app communicates via https with the Joola servers, we need to modify the app to later trust our pinfinity deployment. To achieve that, you need to do the following:
- Create a backup of your Joola Infity app with [SAI](https://github.com/Aefyr/SAI) on your Android device. This will create a `*.apks` file. KEEP THIS FILE IN A SAFE PLACE!
- Copy the `*.apks` to your computer and patch it via [apk-mitm](https://github.com/niklashigi/apk-mitm).
- This will remove the certificate pinning from the app and allows us to trust our self-hosted certificates.
- Copy the patched `*.apks` back to your Android device, uninstall the current Joola app and install the patched app again using [SAI](https://github.com/Aefyr/SAI).

- Next create the certificates as described in the step [Generate TLS certs — MANDATORY (before the first run, and after expiry)](#generate-tls-certs--mandatory-before-the-first-run-and-after-expiry) on the host where you will run pinfinity.
- After the certificate is created, copy the `ca.pem` from the `./certs` folder to your Android device and add it as a trusted CA. (Could be different on your device)
  - Open your device's Settings app.
  - Tap Security & privacy and then More security settings and then Encryption & credentials.
  - Tap Install a certificate and then CA certificate.

- Now configure the necessary values in the `docker-compose.yaml` as described [here](#configure-environment-variables) and then deploy the pinfinity app.

- In the last step, modify the routing in your network router, PiHole, AdGuard Home, etc. to point `api-v6.admin.joola.com` to the IP address from your host that is running the pinfinity app.

## Deploy using Docker Compose

### Generate TLS certs — MANDATORY (before the first run, and after expiry)

TLS certificates are mandatory for this deployment. You must generate or provide the certificate files before starting the stack for the first time, and you must regenerate or replace them after they expire.

The compose helper `docker-compose-certs.yaml` will create a self-signed cert and private key in `./certs`.

Then run (required):

```bash
# REQUIRED: generate certs (will create ./certs/cert.pem and ./certs/key.pem)
docker compose -f ./docker-compose-certs.yaml up -d --remove-orphans

# wait until the certs container finishes (it typically exits after writing files)
docker compose -f ./docker-compose-certs.yaml logs --no-follow
```

After the container finishes, verify that the `./certs` directory exists and contains `cert.pem` and `key.pem`.

### Configure environment variables

Open `docker-compose.yaml` and set the environment variables for the `pinfinity` service:

- `PINFINITY_NAME` — Use the user name from your Joola profile. You can get this from the app. It is the name shown on top when you switch to the more tab.
- `PINFINITY_EMAIL` — Use the email address from your Joola profile.
- `PINFINITY_DEVICE_NAME` — Use any name to identify your robot.
- `PINFINITY_DEVICE_ID` — To get that value go to the app, add a new device and scan the barcode from the back of your robot.
- `PINFINITY_SERIAL_NUMBER` — To get that value go to the app, add a new device and scan the barcode from the back of your robot.

The sample `docker-compose.yaml` already contains placeholders — replace `"XXX"` with real values.

### Start the stack

From the repository root run (this will build the app image then start `pinfinity` and `nginx`):

```bash
docker compose -f ./docker-compose.yaml up -d --build
```

This will create the following on the host:

- `./pinfinity/` (if the host folder is empty, the image entrypoint will seed it using `default-data/`)

## Updates

All relevant user content is stored in `./pinfinity` directory. Make sure to backup `advance-list.json` and `basic-list.json`, as they contain your custom trainings. All other files only contain static content and there is no need to create a backup of these.

You can download `advance-list.json` and `basic-list.json` as a zip file via when you open `https://api-v6.admin.joola.com/api/download/lists` in your browser (ignore certifacte warnings). This is useful for backing up your custom trainings.

## Changelog

### [1.0.1] - 2026-03-07
- Added backup endpoint for downloading training lists
- Added missing save endpoint for advance list
- Added missing set favorite endpoint for advance list

### [1.0.0] - Initial Release
- Complete basic training functionality
- Complete advanced training functionality
- Device management and configuration
- User profile management

## Useful commands

```bash
# start (build + run)
docker compose -f ./docker-compose.yaml up -d --build

# stop
docker compose -f ./docker-compose.yaml down

# show logs
docker compose -f ./docker-compose.yaml logs -f

# run certs generator (if you need to regenerate)
docker compose -f ./docker-compose-certs.yaml up -d

# inspect container shell
docker exec -it pinfinity /bin/sh
```

## Troubleshooting

- Port 443 already in use: stop other services using port 443 or use a reverse proxy.
- Missing `./certs/cert.pem` or `./certs/key.pem`: run the cert generation compose.

If you hit an error not covered here, check the container logs (`docker compose logs`) and paste the relevant output when requesting help.

