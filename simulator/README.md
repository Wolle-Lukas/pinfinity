# Joola Infinity Robot Simulator

Turns a Raspberry Pi into a BLE peripheral that mimics the Joola Infinity table
tennis robot. The app (original Joola app or the custom web frontend) can connect
to it — all received commands are decoded and logged.

## Requirements

- Raspberry Pi with Bluetooth adapter (e.g. Pi 3/4/5 or Pi Zero W)
- Raspberry Pi OS Bookworm (Python 3.11+)
- Internet access for the initial installation

## Installation

```bash
# 1. System packages
sudo apt update
sudo apt install -y python3-pip python3-dbus bluez

# 2. Python dependency
pip3 install -r ~/pinfinity/simulator/requirements.txt
```

## Starting the simulator

```bash
# Enable BLE adapter (once per boot)
sudo hciconfig hci0 up
sudo btmgmt le on

# Start the simulator
sudo python3 ~/pinfinity/simulator/robot_simulator.py
```

The Pi now advertises itself as `J-0102030405060708` and waits for connections.

### Custom device ID

If you know the real ID of your robot (visible in a BT sniffer or via
`adb logcat`), pass it with `--device-id` — this makes the original Joola app
accept the connection without complaints:

```bash
sudo python3 ~/pinfinity/simulator/robot_simulator.py --device-id 98D331F33F040001
```

### Verbose mode (raw hex dumps)

```bash
sudo python3 ~/pinfinity/simulator/robot_simulator.py --verbose
```

## Connecting

**Custom web frontend:** Click "Connect" in the browser → the Pi appears in the
device picker as `J-...`.

**Original Joola app:** Open the app, scan for devices → the Pi appears, connect.

## Reading commands via adb logcat

Connect an Android device via USB, enable USB debugging, then run:

```bash
adb logcat | grep -i "bluetooth\|joola\|robot|datacontent:"
```

## Example output

```
12:34:56  INFO     Advertising as 'J-0102030405060708'
12:34:56  INFO     Waiting for connections… (Ctrl+C to stop)
12:35:02  INFO     [CMD_CONNECT] payload=00
12:35:02  INFO     [ACK] cmd=0x81  68 01 ...
12:35:05  INFO     [CMD_PATTERN] 3 point(s):
12:35:05  INFO       [0] landarea=12  depth=2  spin=1  speed=1792  m1=8 m2=24  x=13 y=14 z=10
12:35:05  INFO       [1] landarea=11  depth=2  spin=0  speed=1792  ...
12:35:05  INFO       [2] landarea=13  depth=2  spin=2  speed=1792  ...
12:35:05  INFO     [ACK] cmd=0x8f  ...
12:35:05  INFO     [ACK] cmd=0x82  ...
12:35:10  INFO     [CMD_STOP]
```

## Troubleshooting

| Problem | Solution |
|---|---|
| `bless` import fails | Re-run `pip3 install bless`, add `--break-system-packages` if needed |
| `hciconfig: command not found` | `sudo apt install bluez` |
| Device does not appear in the app | Run `sudo btmgmt le on`, then restart the simulator |
| `Permission denied` on startup | Run the script with `sudo` |
