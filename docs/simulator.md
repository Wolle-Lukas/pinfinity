# Joola Infinity Robot Simulator

Turns a Raspberry Pi into a BLE peripheral that mimics the Joola Infinity table tennis robot. The app (original Joola app or the custom web frontend) can connect to it — all received commands are decoded and logged.

Useful for development and testing without a physical robot.

---

## Requirements

- Raspberry Pi with Bluetooth adapter (e.g. Pi 3/4/5 or Pi Zero W)
- Raspberry Pi OS Bookworm (Python 3.11+)
- Internet access for the initial installation

---

## Installation

```bash
# 1. System packages
sudo apt update
sudo apt install -y python3-venv python3-dbus bluez

# 2. Virtual environment + Python dependency
python3 -m venv ~/simulator-venv
~/simulator-venv/bin/pip install -r ~/pinfinity/simulator/requirements.txt
```

### BlueZ Configuration

Enable BLE advertising and auto-power in `/etc/bluetooth/main.conf`:

```ini
[General]
Experimental = true

[Policy]
AutoEnable = true
```

Then restart Bluetooth:

```bash
sudo systemctl restart bluetooth
```

`Experimental = true` enables the LE Advertising Manager required by `bless`.
`AutoEnable = true` ensures the adapter is powered on automatically after every reboot.

---

## Starting the Simulator

Use the provided start script — it handles rfkill unblocking, Bluetooth restart, and the venv Python path automatically:

```bash
~/pinfinity/simulator/start.sh
```

Make the script executable once after cloning:

```bash
chmod +x ~/pinfinity/simulator/start.sh
```

The Pi now advertises itself as `J-0102030405060708` and waits for connections.

### Options

All arguments are passed through to `robot_simulator.py`:

```bash
~/pinfinity/simulator/start.sh --device-id 00A331D33F040001 --drill-duration 20 --verbose
```

| Flag | Description |
|---|---|
| `--device-id <ID>` | Use the real device ID of your robot (visible in a BT sniffer or via `adb logcat`). Makes the original Joola app accept the connection without complaints. |
| `--drill-duration <seconds>` | How long to keep the drill "running" before sending the drill-end signal. Default: 0.1 s (almost instant). Useful for testing the Stop flow. |
| `--verbose` | Print raw hex dumps of all received and sent frames. |

---

## Connecting

**Custom web frontend:** Click "Connect" in the browser — the Pi appears in the device picker as `J-…`.

**Original Joola app:** Open the app, scan for devices — the Pi appears, connect normally.

---

## Example Output

```
12:34:56  INFO     Advertising as 'J-0102030405060708'
12:34:56  INFO     Waiting for connections… (Ctrl+C to stop)
12:35:02  INFO     [CMD_CONNECT] payload=00
12:35:02  INFO     [ACK] cmd=0x81  68 01 ...
12:35:05  INFO     [CMD_PATTERN] 3 point(s):
12:35:05  INFO       [0] landarea=12  depth=2  spin=1  speed=1792  m1=8 m2=24  x=13 y=14 z=10
12:35:05  INFO       [1] landarea=11  depth=2  spin=0  speed=1792  ...
12:35:05  INFO       [2] landarea=13  depth=2  spin=2  speed=1792  ...
12:35:05  INFO     [ACK] cmd=0x81  ...
12:35:05  INFO     [ACK] cmd=0x82  ...
12:35:10  INFO     [CMD_STOP]
```

---

## Reading Commands via adb logcat

Connect an Android device via USB, enable USB debugging, then run:

```bash
adb logcat | grep -i "bluetooth\|joola\|robot|datacontent:"
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `bless` import fails | Verify you are using the venv Python: `~/simulator-venv/bin/python3` |
| `Permission denied` on startup | Run the script with `sudo` |
| Device does not appear in the app | See below |

### Adapter Soft-Blocked / `Powered: no`

If `bluetoothctl show` shows `Powered: no` or `rfkill list bluetooth` shows `Soft blocked: yes`:

```bash
sudo rfkill unblock bluetooth
sudo bluetoothctl power on
```

To prevent this after every reboot, set `AutoEnable = true` in `/etc/bluetooth/main.conf` (see Installation above).

### `Failed to register advertisement`

Two common causes:

**1. `Experimental` key in wrong section** — Check `systemctl status bluetooth` for `Unknown key Experimental`. If present, move the key from `[Policy]` to `[General]` in `/etc/bluetooth/main.conf`, then restart Bluetooth.

**2. Stale advertisement state from a previous run** — Always restart Bluetooth before starting the simulator. The start script does this automatically.

If the error persists, check the BlueZ log:

```bash
sudo journalctl -u bluetooth -n 30 --no-pager
```
