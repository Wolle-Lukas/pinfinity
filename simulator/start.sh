#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$HOME/simulator-venv/bin/python3"

echo "Unblocking Bluetooth..."
sudo rfkill unblock bluetooth

echo "Restarting Bluetooth service..."
sudo systemctl restart bluetooth
sleep 5

echo "Starting simulator..."
exec sudo "$VENV_PYTHON" "$SCRIPT_DIR/robot_simulator.py" "$@"
