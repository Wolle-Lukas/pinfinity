#!/bin/bash


DATA_DIR="/app/app/data"
TEMPLATE_DIR="/app/app/default-data"


# Ensure the data directory exists
if [ ! -d "$DATA_DIR" ]; then
  echo "Data directory $DATA_DIR does not exist. Creating it..."
  mkdir -p "$DATA_DIR"
fi


# If the data directory is empty, copy all files. Otherwise, copy all except basic-list.json and advance-list.json.
if [ -z "$(ls -A $DATA_DIR)" ]; then
  echo "Data directory is empty. Copying all templates from $TEMPLATE_DIR..."
  cp -r "$TEMPLATE_DIR/"* "$DATA_DIR/"
else
  echo "Copying templates from $TEMPLATE_DIR to $DATA_DIR, excluding basic-list.json and advance-list.json..."
  find "$TEMPLATE_DIR" -type f ! -name "basic-list.json" ! -name "advance-list.json" -exec cp -f {} "$DATA_DIR/" \;
fi

# If environment variables prefixed with "pinfinity-" are present, override
# the corresponding fields in user-info.json (Python reads env vars directly
# to avoid shell-quoting issues).
USER_INFO_FILE="$DATA_DIR/user-info.json"

if [ -f "$USER_INFO_FILE" ]; then
  echo "Applying pinfinity-* environment overrides to $USER_INFO_FILE (if provided)..."

  python - <<PY
import os, json
from pathlib import Path

f = Path(r"$USER_INFO_FILE")
# Only accept uppercase environment variable names per project convention
env_name = os.environ.get('PINFINITY_NAME')
env_email = os.environ.get('PINFINITY_EMAIL')

if not f.exists():
  print(f"{f} does not exist")
  raise SystemExit(0)

try:
  data = json.loads(f.read_text())
except Exception as e:
  print(f"Failed to read/parse {f}: {e}")
  raise SystemExit(1)

user = data.get('data') or {}
changed = False
if env_name:
  user['name'] = env_name
  changed = True
if env_email:
  user['email'] = env_email
  changed = True

if changed:
  data['data'] = user
  f.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
  print(f"Updated {f}")
else:
  print("No PINFINITY_NAME/PINFINITY_EMAIL provided; no changes made.")
PY
fi

# If environment variables prefixed with "pinfinity-" are present, override
# the corresponding fields in device-list.json (Python reads env vars directly
# to avoid shell-quoting issues).
DEVICE_LIST_FILE="$DATA_DIR/device-list.json"

if [ -f "$DEVICE_LIST_FILE" ]; then
  echo "Applying pinfinity-* environment overrides to $DEVICE_LIST_FILE (if provided)..."
  python - <<PY
import os, json
from pathlib import Path

f = Path(r"$DEVICE_LIST_FILE")
# Only accept uppercase environment variable names per project convention
env_dev_id = os.environ.get('PINFINITY_DEVICE_ID')
env_dev_name = os.environ.get('PINFINITY_DEVICE_NAME')
env_serial = os.environ.get('PINFINITY_SERIAL_NUMBER')

if not f.exists():
  print(f"{f} does not exist")
  raise SystemExit(0)

try:
  data = json.loads(f.read_text())
except Exception as e:
  print(f"Failed to read/parse {f}: {e}")
  raise SystemExit(1)
arr = data.get('data')
if not isinstance(arr, list):
  print(f"Unexpected format in {f}: 'data' is not a list")
  raise SystemExit(1)

changed = False
for entry in arr:
  if env_dev_id:
    entry['deviceId'] = env_dev_id
    changed = True
  if env_dev_name:
    entry['deviceName'] = env_dev_name
    changed = True
  if env_serial:
    entry['serialNumber'] = env_serial
    changed = True

if changed:
  data['data'] = arr
  f.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
  print(f"Updated {f}")
else:
  print("No PINFINITY_DEVICE_ID/PINFINITY_DEVICE_NAME/PINFINITY_SERIAL_NUMBER provided; no changes made.")
PY
fi

echo "Starting application..."
exec "$@"
