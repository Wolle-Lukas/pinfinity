# Pinfinity – Joola Infinity Robot Bluetooth Protocol

> **Status:** Protocol fully validated and working (connect, pattern send, and stop all confirmed via live robot ACKs).
> **Last updated:** 2026-04-17
> **Source:** Reverse-engineered via protocol analysis (HCI snoop logs + Android app logcat).

---

## Table of Contents

1. [BLE Transport Layer](#1-ble-transport-layer)
2. [Frame Format](#2-frame-format)
3. [CRC Algorithm](#3-crc-algorithm)
4. [Device ID Encoding](#4-device-id-encoding)
5. [Command Reference](#5-command-reference)
6. [Pattern Payload Encoding](#6-pattern-payload-encoding)
7. [Base-Conf Lookup Table](#7-base-conf-lookup-table)
8. [Connection Lifecycle](#8-connection-lifecycle)
9. [Response / Notification Handling](#9-response--notification-handling)
10. [Known Unknowns](#10-known-unknowns)
11. [Changelog](#11-changelog)

---

## 1. BLE Transport Layer

The robot exposes a BLE GATT server. The web frontend connects using the Web Bluetooth API.

### Device Discovery

```
Filter: namePrefix = "J-"
Example device name: J-00A331D33F040001
```

### GATT Services & Characteristics

| Role | UUID |
|---|---|
| **Primary Service** | `0000ffe0-0000-1000-8000-00805f9b34fb` |
| Primary Write+Notify Characteristic | `0000ffe1-0000-1000-8000-00805f9b34fb` |
| **Alternative Service** (newer firmware) | `0000fee7-0000-1000-8000-00805f9b34fb` |
| Alt Write Characteristic | `0000fec8-0000-1000-8000-00805f9b34fb` |
| Alt Notify Characteristic | `0000fec7-0000-1000-8000-00805f9b34fb` |

The frontend tries the primary service (`FFE0`) first and falls back to the alternative (`FEE7`). The service variant also determines which pattern command byte to use — see [Known Unknowns §Alternate Pattern Command](#alternate-pattern-command-0x98).

### Chunked Writes

- MTU: **20 bytes**
- Method: `writeValueWithoutResponse` (no acknowledgement per chunk)
- No inter-chunk delay required
- Frames longer than 20 bytes are split into consecutive 20-byte chunks

---

## 2. Frame Format

Every outgoing and incoming message uses the same envelope:

```
Offset  Size  Description
──────  ────  ─────────────────────────────────────────────────────
[0]     1     FRAME_START  = 0x68
[1]     1     FRAME_FIXED  = 0x01  (constant in all frames)
[2-9]   8     Device ID bytes (hex-decoded from name suffix, big-endian)
[10]    1     FRAME_START  = 0x68  (second marker)
[11]    1     Command byte
[12]    1     Payload length HIGH byte  (big-endian)
[13]    1     Payload length LOW byte
[14…]   N     Payload  (N = payload length from bytes 12-13)
[-3]    1     CRC HIGH byte  (CRC-CCITT over bytes [0 … 13+N])
[-2]    1     CRC LOW byte
[-1]    1     FRAME_END = 0x16
```

**Total frame size:** `14 + N + 3 = N + 17 bytes`

**Minimum frame size:** 17 bytes (empty payload, N=0)

### Critical Encoding Rules

- **Byte order is big-endian** for the length field (bytes 12-13) and the CRC field (bytes -3, -2).
- The CRC covers the entire frame from byte [0] up to and including the last payload byte — it does **not** cover the CRC bytes themselves or the FRAME_END byte.

---

## 3. CRC Algorithm

**Algorithm:** CRC-CCITT  
**Polynomial:** 0x1021  
**Initial value:** 0x0000  

> **Not** CRC-16 Modbus (poly 0xA001, init 0xFFFF) — using the wrong algorithm causes the robot to silently drop every frame.

### Reference Implementation (JavaScript)

```javascript
const CRC_TABLE = [
  0, 4129, 8258, 12387, /* … full 256-entry table in bluetooth.js … */
];

function crcCCITT(data) {
  let crc = 0;
  for (const b of data) {
    crc = (CRC_TABLE[((crc >> 8) ^ b) & 0xFF] ^ (crc << 8)) & 0xFFFF;
  }
  return crc;
}
```

The full table is in [frontend/js/bluetooth.js](../frontend/js/bluetooth.js) lines 51–68.

---

## 4. Device ID Encoding

The device ID is embedded in the BLE advertisement name after the `J-` prefix:

```
Device name:  J-00A331D33F040001
              ^^^^^^^^^^^^^^^^^^
              16 hex characters = 8 bytes when hex-decoded
```

**Encoding:** hex-decode the 16-char string into 8 raw bytes.

```
"00A331D33F040001"  →  { 0x00, 0xA3, 0x31, 0xD3, 0x3F, 0x04, 0x00, 0x01 }
```

> **Not** ASCII-encoding the characters (which would give `{ 0x30, 0x30, … }`).

These 8 bytes occupy frame positions [2–9].

---

## 5. Command Reference

| Constant | Value | Payload | Description |
|---|---|---|---|
| `CMD_CONNECT` | `0x89` | `{ 0x00 }` (1 byte) | Application-level handshake after GATT connect |
| `CMD_DISCONNECT` | `0x99` | `{ 0x00 }` (1 byte) | Graceful disconnect notification |
| `CMD_PATTERN` | `0x01` | `(N×12) + 4` bytes | Send a drill pattern (see §6) |
| `CMD_CONTROL` | `0x03` | `{ 0x00 }` = stop · `{ 0x01 }` = start calibration | Generic control command; sub-action in `payload[0]` |
| `CMD_GET_INFO` | `0x05` | empty (0 bytes) | Requests device/firmware info. Robot replies with cmd `0x85` (4-byte firmware version). |

### Notes

- `CMD_CONNECT` payload must be exactly `{ 0x00 }` — an **empty** payload (`new Uint8Array(0)`) causes the robot to ignore the frame.
- **Stop** is `CMD_CONTROL` with `payload = { 0x00 }`. An earlier version of this doc and the frontend mistakenly used cmd `0x05` with an empty payload for stop — that is actually `CMD_GET_INFO` and elicits the firmware-version frame (`0x85`) instead of stopping the drill.
- **Start calibration** is `CMD_CONTROL` with `payload = { 0x01 }`. Both stop and calibration share cmd byte `0x03` and differ only in the single sub-action byte.
- `CMD_GET_INFO` is what the original app sends right after the GATT connection is established (before `CMD_CONNECT`) and when opening the Firmware/Equipment screens — it is **not** a stop command.
- Newer firmware may require `0x98` instead of `0x01` for PATTERN when the alternative `FEE7/FEC8` service is active (see [Known Unknowns](#alternate-pattern-command-0x98)).

---

## 6. Pattern Payload Encoding

A PATTERN payload encodes one or more ball-landing positions ("points"). Each point is 12 bytes, followed by a fixed 4-byte trailer.

**Total payload size:** `(N × 12) + 4` bytes

### Per-Point Layout (12 bytes)

Confirmed against Android app logcat (`BT/20260406_App_logs.txt`).

```
Byte  Name            Source / Notes
────  ──────────────  ────────────────────────────────────────────────
 0    m1speed         base-conf lookup  (NOT raw ball value)
 1    m2speed         base-conf lookup  (NOT raw spin value)
 2    xaxis           base-conf lookup  (NOT raw power value)
 3    yaxis           base-conf lookup  (NOT raw landarea value)
 4    zaxis           base-conf lookup
 5    (zero)          0x00 always
 6    times/flag      sequential: drill.times (ball count, 1 byte)
                      random:     0x01
 7    ball_timing     single-point: (int)((19 − ballTime) × 3.5), range 0–63
                      multi-point:  0x00 (ball_time byte carries the value)
                      random:       0x80 (mode flag)
 8    ball_time       single-point sequential: 0x00 (ball_timing byte carries the value)
                      multi-point sequential: raw app ballTime value (1–20)
                      random:       raw app ballTime value (1–20)
 9    depth           p.y − 1  (0-indexed: JSON y=2 → sends 1)
10    landType        drill.landType  (0=sequential, 2=random)
11    isRandom        0 for sequential, 1 for random
```

> **Important:** Bytes 0–4 come from the `base-conf` lookup table, not from the raw UI parameters. Sending raw values causes wrong motor behaviour.

> **x (landarea) is NOT transmitted separately** — it is fully encoded in bytes 0–4 via the base-conf lookup.

### Pattern Trailer (4 bytes)

Appended after all point data:

```
Byte  Value                       Notes
────  ────────────────────────    ──────────────────────────────────────────
 0    sequential: drill.numType   1 = ball-count mode (most trainings)
      random:     drill.times     total ball count to play before stopping
 1    0x00                        (was incorrectly documented as 0x01)
 2    0x00
 3    0x00
```

### Grid / Position Mapping

```
x = landarea (1–15)  — directly maps to grid cells A1–A15
    Row 0 (closest):  A1–A5   → x = 1–5
    Row 1 (middle):   A6–A10  → x = 6–10
    Row 2 (far):      A11–A15 → x = 11–15

y = depth parameter (1=short, 2=medium, 3=long)
    Default: y=2 (medium)
    Protocol uses y−1 (0-indexed): JSON y=2 → transmitted as 1
```

### ballTime Encoding

Ball timing is encoded differently depending on how many points the pattern has:

**Single-point patterns (N=1):**
- Byte 7 (`ball_timing`): `(int)((19 − ballTime) × 3.5)`, clamped to 0 for ballTime ≥ 20. Range 0–63.
- Byte 8 (`ball_time`): always `0x00`.

**Multi-point patterns (N>1):**
- Byte 7 (`ball_timing`): always `0x00`.
- Byte 8 (`ball_time`): raw app value (1–20).

The app UI exposes ballTime as a slider from 1 (most frequent) to 20 (least frequent). Both BT=19 and BT=20 produce wire value 0 for single-point (negative result clamped).

Confirmed against all 20 slider positions in live simulator logs.

> Previous documentation describing byte 7 as `spin` (0–5) and byte 8 as raw ballTime for all patterns was **incorrect**.

---

## 7. Base-Conf Lookup Table

Motor parameters (bytes 0–4 of each point) are not computed from the raw UI parameters. Instead, they are looked up from a server-side configuration table.

### API Endpoint

```
GET /api/base/conf
Response: { data: [ ...entries ] }
```

### Entry Shape

```json
{
  "ball":     0,       // 0=Serve, 1=Topspin, 2=Lob
  "spin":     0,       // 0=No-spin, 1=Topspin, 2=Sidespin-R, 3=Sidespin-L, 4=Backspin, 5=Max-Backspin
  "power":    0,       // 0=Extreme, 1=Strong, 2=Medium, 3=Light
  "landarea": 11,      // 1–15
  "m1speed":  8,
  "m2speed":  24,
  "xaxis":    13,
  "yaxis":    14,
  "zaxis":    10
}
```

### Confirmed Match

For `ball=1, spin=1, power=1, landarea=12`:

```
Lookup result: m1=8, m2=24, xaxis=13, yaxis=14, zaxis=10
Bytes 0-4:     08 18 0D 0E 0A
BTSnoop log frame 2: 08 18 0D 0E 0A  ✓
```

### Impossible Combinations

11 of the 60 `(ball × spin × power)` combinations have no base-conf entries and are therefore blocked in the UI:

| Ball | Power | Spin | Reason |
|---|---|---|---|
| Serve (0) | Extreme (0) | Backspin (4), Max-Backspin (5) | No entry |
| Lob (2) | Extreme (0) | All (0–5) | No entry |
| Lob (2) | Strong (1) | Spins 1–4 | No entry |

### Land Area Availability

Not all 15 cells are reachable for every combination:

| Power | Available Land Areas |
|---|---|
| Extreme (0) or Strong (1) | 11–15 only (far row) |
| Medium (2) or Light non-Lob (3, ball≠2) | 6–15 (middle + far rows) |
| Light + Lob (ball=2) | 6–15 |
| Light + Serve/Topspin (ball=0/1) | 1–15 (all cells) |

Unavailable cells are shown with red ✕ overlays and are not clickable.

---

## 8. Connection Lifecycle

```
Browser                              Robot (BLE)
───────                              ───────────
navigator.bluetooth.requestDevice()
                                 ←── Advertisement (namePrefix "J-")
device.gatt.connect()
                                 ←── GATT connection established
server.getPrimaryService(FFE0)   (or FEE7 fallback)
service.getCharacteristic(FFE1)  (or FEC8 write / FEC7 notify)
char.startNotifications()
                                 ←── Notification subscription ACK
_send(CMD_CONNECT, {0x00})
                                 ←── 0x81 (connect ACK)
── CONNECTED ──

_send(CMD_PATTERN, payload)
                                 ←── 0x8f (pattern received ACK)
                                 ←── 0x82 (drill started ACK)
── DRILL RUNNING ──

_send(CMD_CONTROL, {0x00})       (stop sub-action)
                                 ←── 0x83 (control ACK)
── STOPPED ──

_send(CMD_DISCONNECT, {0x00})
device.gatt.disconnect()
── DISCONNECTED ──
```

---

## 9. Response / Notification Handling

The robot sends responses using the same frame format as outgoing commands.

### Response Reassembly

BLE notifications arrive in ≤20-byte chunks. The receive buffer accumulates chunks until a complete frame is detected:

- A chunk starting with `0x68` (FRAME_START) **resets** the buffer and begins a new frame.
- Accumulation continues until the last byte of a chunk is `0x16` (FRAME_END).
- The assembled frame is then parsed and validated.

### Known Response Commands

| Command | Value | Meaning | Verified |
|---|---|---|---|
| Connect ACK | `0x81` | Robot acknowledged CMD_CONNECT | Observed live |
| Pattern ACK | `0x8f` | Robot acknowledged CMD_PATTERN receipt | Observed live |
| Drill Start ACK | `0x82` | Robot confirmed drill started | Observed live |
| Control ACK | `0x83` | Ack for `CMD_CONTROL` (stop / cancel). `payload[0]`: `0x00`/`0x01` = drill stopped or control aborted, `0x02` = calibration complete | Confirmed |
| Firmware Version | `0x85` | 4-byte payload: `[major, minor, patch, build]` — response to `CMD_GET_INFO` | Confirmed |

Responses `0x8f` and `0x82` semantics are inferred from the observed connection-log sequence. `0x83` and `0x85` are additionally confirmed via controlled testing.

### CRC Validation (Incoming)

Incoming frames are CRC-checked using the same CRC-CCITT algorithm. A mismatch is logged as a warning but does not halt processing.

---

## 10. Known Unknowns

### ballTime=0 for single-point sequential trainings

The original app sends `byte 8 = 0x00` for single-point sequential trainings even when the JSON
`ballTime` field is non-zero (confirmed: a training with JSON `ballTime=18` shows `0x00` in the
log). Our implementation sends the actual JSON value. The robot likely ignores byte 8 in single-point
sequential mode. No issue expected, but to confirm: record a sequential multi-point training.

### Byte 6 for random mode = 0x01

Both logged trainings have `numType=1` and `ball=1`, so we cannot tell if `0x01` in random mode
means "numType", "ball", or "1 ball per visit per cycle". To resolve: log a random training
with `ball=0` (Serve mode).

### Byte 7 = 0x80 for random — is spin hidden in lower bits?

Both examples use `spin=3`. If the lower 5 bits of byte 7 carry spin, they would be `0` for
`0x80`, not `3`. To resolve: log a random training with a different spin value (e.g., `spin=1`).

### numType=0 (time-based training) encoding

No example of `numType=0` was recorded. Unknown how the `times × 30 s` duration is encoded.

### ballTime unit / scale

`ballTime=12` → `0x0C` (raw). The time unit (seconds, deciseconds, robot-internal ticks) is
not confirmed. The UI currently uses `21 − sliderValue` as the raw ballTime value.

### base-conf.json yaxis discrepancy for landarea=8

`base-conf.json` has `yaxis=14` for `ball=1, spin=3, power=2, landarea=8`, but the original
app sent `0x0F=15` for that position. Our copy of base-conf.json may be slightly outdated.

### CMD_GET_INFO on GATT Connect

The original app sends `CMD_GET_INFO (0x05)` immediately after the GATT connection is established,
before `CMD_CONNECT`. The robot replies with the firmware-version frame (`0x85`). The frontend
currently skips this step and the robot still works, but some firmware versions may expect the
version handshake before accepting other commands.

> An earlier revision of this doc labelled cmd `0x05` as `CMD_STOP`. That was a misidentification
> — `0x05` queries device info, and the actual stop command is `CMD_CONTROL=0x03` with payload `{0x00}`.

### Alternate Pattern Command (0x98)

When the alternative `FEE7/FEC8` service is detected (newer firmware), `cmd=0x98` may be required
instead of `0x01` for sending patterns. Our frontend currently always uses `0x01`. This may need
to be changed if alt-service robots fail to accept patterns.

### Response Semantics

`0x82` is sent by the robot when the drill ends (confirmed: app shows "Ballausgabe abgeschlossen" on receipt). It does **not** signal drill start.

`0x83` is the ACK for `CMD_CONTROL` (stop/calibration). `payload[0]` values: `0x00` = drill stopped, `0x01` = control aborted, `0x02` = calibration complete.

`0x84` (payload `0x01`) appears periodically in the btsnoop log while a drill is active. Hypothesis: sending `0x84` immediately after `0x8f` triggers the app's "drill running" screen. Unverified — needs live testing.

---

## 11. Changelog

All fixes are implemented in [frontend/js/bluetooth.js](../frontend/js/bluetooth.js).

### Initial protocol fixes (discovered via HCI snoop log analysis)

| # | Bug | Was | Fixed To |
|---|---|---|---|
| 1 | Wrong CRC algorithm | CRC-16 Modbus (0xA001, init 0xFFFF) | CRC-CCITT (0x1021, init 0x0000) |
| 2 | Wrong device ID encoding | ASCII-encode first 8 chars | Hex-decode all 16 chars to 8 bytes |
| 3 | Wrong byte order for length + CRC | Little-endian | Big-endian |
| 4 | Missing connect payload | Empty (`Uint8Array(0)`) | `{ 0x00 }` (1 byte) |
| 5 | Missing pattern trailer | N × 12 bytes only | + 4 bytes `{1,1,0,0}` |
| 6 | Speed byte order in pattern | Little-endian | Big-endian |

### Motor parameter fixes (2026-04-04, discovered via logcat analysis)

| # | Fix | Description |
|---|---|---|
| 7 | Wrong motor parameters | Bytes 0–4 must come from base-conf lookup, not raw ball/spin/power values |
| 8 | Impossible combo selection | 11 combos with no base-conf entries blocked in UI |
| 9 | Unavailable land areas | Cells not reachable for given combo shown as red ✕ and disabled |

### Stop command fix (2026-04-17)

| # | Bug | Was | Fixed To |
|---|---|---|---|
| 10 | Wrong stop command | cmd `0x05` + empty payload (actually `CMD_GET_INFO` — triggers firmware-version reply, drill keeps running) | cmd `0x03` + payload `{ 0x00 }` (`CMD_CONTROL` stop sub-action) |

### Simulator drill-lifecycle fix (2026-04-18)

| # | Bug | Was | Fixed To |
|---|---|---|---|
| 11 | "Drill running" screen missing | Simulator never sent `0x84` during drill | `0x84 {0x01}` sent immediately after `0x8f` (hypothesis: triggers app's "drill running" screen) |
| 12 | `CMD_CONTROL` not ACKed | Simulator logged stop/calibration but never sent `0x83` reply | `0x83 {0x00}` sent for stop, `0x83 {0x02}` for calibration complete |

---
