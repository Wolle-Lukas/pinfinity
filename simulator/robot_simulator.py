#!/usr/bin/env python3
"""
Joola Infinity Robot BLE Simulator

Advertises a Raspberry Pi as a Joola Infinity table tennis robot over BLE,
accepts incoming GATT connections, parses and logs all robot protocol frames,
and sends minimal ACK responses so the app believes it is talking to a real robot.

Usage:
    sudo python3 robot_simulator.py
    sudo python3 robot_simulator.py --device-id 0102030405060708
    sudo python3 robot_simulator.py --verbose

Requirements:
    pip install -r requirements.txt
    sudo apt install bluez python3-dbus
"""

import argparse
import asyncio
import logging
import sys
from typing import Optional

try:
    from bless import (
        BlessServer,
        BlessGATTCharacteristic,
        GATTCharacteristicProperties,
        GATTAttributePermissions,
    )
except ImportError:
    print(
        "ERROR: 'bless' library not installed. Run: pip install bless", file=sys.stderr
    )
    sys.exit(1)

# ── BLE UUIDs ────────────────────────────────────────────────────────────────
SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb"
CHAR_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb"

# ── Frame constants ──────────────────────────────────────────────────────────
FRAME_START = 0x68
FRAME_END = 0x16
FRAME_FIXED = 0x01

# ── Command bytes ────────────────────────────────────────────────────────────
CMD_CONNECT = 0x89
CMD_DISCONNECT = 0x99
CMD_PATTERN = 0x01  # standard firmware
CMD_PATTERN_ALT = 0x98  # newer firmware variant
CMD_CONTROL = 0x03  # payload[0]: 0x00=stop, 0x01=start calibration
CMD_STATUS = 0x05  # heartbeat poll sent every ~3 s while a drill is running

CTRL_STOP = 0x00
CTRL_CALIBRATION = 0x01

CMD_NAMES = {
    CMD_CONNECT: "CONNECT",
    CMD_DISCONNECT: "DISCONNECT",
    CMD_PATTERN: "PATTERN",
    CMD_PATTERN_ALT: "PATTERN_ALT",
    CMD_CONTROL: "CONTROL",
    CMD_STATUS: "STATUS",
}

# ── ACK response command bytes ───────────────────────────────────────────────
# 0x81: triggers "drill running" screen in app (also used as connect ACK)
# 0x82: ends drill ("Ballausgabe abgeschlossen")
# 0x8f: error code — do NOT send after CMD_PATTERN
# 0x83: ball output status / control ACK
ACK_CONNECT = 0x81  # response to CMD_CONNECT (handled by connection screen)
ACK_DRILL_RUNNING = (
    0x81  # same byte — in drill context: triggers "drill running" screen
)
ACK_DRILL_END = (
    0x82  # drill completed: hides running screen, shows "Ballausgabe abgeschlossen"
)
ACK_CONTROL = 0x83  # ack for CMD_CONTROL (stop/cancel/calibration)
ACK_STATUS = 0x85  # response to CMD_STATUS

# ── CRC-CCITT (poly=0x1021, init=0x0000) ─────────────────────────────────────
# Lookup table extracted from the original Joola robot APK (via frontend/js/bluetooth.js)
_CRC_TABLE = [
    0,
    4129,
    8258,
    12387,
    16516,
    20645,
    24774,
    28903,
    33032,
    37161,
    41290,
    45419,
    49548,
    53677,
    57806,
    61935,
    4657,
    528,
    12915,
    8786,
    21173,
    17044,
    29431,
    25302,
    37689,
    33560,
    45947,
    41818,
    54205,
    50076,
    62463,
    58334,
    9314,
    13379,
    1056,
    5121,
    25830,
    29895,
    17572,
    21637,
    42346,
    46411,
    34088,
    38153,
    58862,
    62927,
    50604,
    54669,
    13907,
    9842,
    5649,
    1584,
    30423,
    26358,
    22165,
    18100,
    46939,
    42874,
    38681,
    34616,
    63455,
    59390,
    55197,
    51132,
    18628,
    22757,
    26758,
    30887,
    2112,
    6241,
    10242,
    14371,
    51660,
    55789,
    59790,
    63919,
    35144,
    39273,
    43274,
    47403,
    23285,
    19156,
    31415,
    27286,
    6769,
    2640,
    14899,
    10770,
    56317,
    52188,
    64447,
    60318,
    39801,
    35672,
    47931,
    43802,
    27814,
    31879,
    19684,
    23749,
    11298,
    15363,
    3168,
    7233,
    60846,
    64911,
    52716,
    56781,
    44330,
    48395,
    36200,
    40265,
    32407,
    28342,
    24277,
    20212,
    15891,
    11826,
    7761,
    3696,
    65439,
    61374,
    57309,
    53244,
    48923,
    44858,
    40793,
    36728,
    37256,
    33193,
    45514,
    41451,
    53516,
    49453,
    61774,
    57711,
    4224,
    161,
    12482,
    8419,
    20484,
    16421,
    28742,
    24679,
    33721,
    37784,
    41979,
    46042,
    49981,
    54044,
    58239,
    62302,
    689,
    4752,
    8947,
    13010,
    16949,
    21012,
    25207,
    29270,
    46570,
    42443,
    38312,
    34185,
    62830,
    58703,
    54572,
    50445,
    13538,
    9411,
    5280,
    1153,
    29798,
    25671,
    21540,
    17413,
    42971,
    47098,
    34713,
    38840,
    59231,
    63358,
    50973,
    55100,
    9939,
    14066,
    1681,
    5808,
    26199,
    30326,
    17941,
    22068,
    55628,
    51565,
    63758,
    59695,
    39368,
    35305,
    47498,
    43435,
    22596,
    18533,
    30726,
    26663,
    6336,
    2273,
    14466,
    10403,
    52093,
    56156,
    60223,
    64286,
    35833,
    39896,
    43963,
    48026,
    19061,
    23124,
    27191,
    31254,
    2801,
    6864,
    10931,
    14994,
    64814,
    60687,
    56684,
    52557,
    48554,
    44427,
    40424,
    36297,
    31782,
    27655,
    23652,
    19525,
    15522,
    11395,
    7392,
    3265,
    61215,
    65342,
    53085,
    57212,
    44955,
    49082,
    36825,
    40952,
    28183,
    32310,
    20053,
    24180,
    11923,
    16050,
    3793,
    7920,
]


def _crc_ccitt(data: bytes) -> int:
    """CRC-CCITT checksum (poly=0x1021, init=0x0000)."""
    crc = 0
    for b in data:
        crc = (_CRC_TABLE[((crc >> 8) ^ b) & 0xFF] ^ (crc << 8)) & 0xFFFF
    return crc


# ── Frame builder ────────────────────────────────────────────────────────────


def _build_frame(device_id_bytes: bytes, cmd: int, payload: bytes) -> bytes:
    """
    Build a complete robot protocol frame.

    Frame layout:
        [0]    FRAME_START (0x68)
        [1]    FRAME_FIXED (0x01)
        [2-9]  device ID (8 bytes)
        [10]   FRAME_START (0x68)
        [11]   command byte
        [12]   payload length high byte (big-endian)
        [13]   payload length low byte
        [14…]  payload (N bytes)
        [-3]   CRC high byte (big-endian, CRC-CCITT over bytes 0..13+N)
        [-2]   CRC low byte
        [-1]   FRAME_END (0x16)
    """
    length = len(payload)
    frame = bytearray()
    frame.append(FRAME_START)
    frame.append(FRAME_FIXED)
    frame.extend(device_id_bytes[:8])
    frame.append(FRAME_START)
    frame.append(cmd & 0xFF)
    frame.append((length >> 8) & 0xFF)  # length high byte (big-endian)
    frame.append(length & 0xFF)  # length low byte
    frame.extend(payload)
    crc = _crc_ccitt(bytes(frame))
    frame.append((crc >> 8) & 0xFF)  # CRC high byte (big-endian)
    frame.append(crc & 0xFF)  # CRC low byte
    frame.append(FRAME_END)
    return bytes(frame)


# ── Frame parser ─────────────────────────────────────────────────────────────


def _parse_frame(data: bytes) -> Optional[dict]:
    """
    Parse a complete robot protocol frame.

    Returns a dict with keys:
        cmd, cmd_name, device_id (bytes), device_id_hex, payload, crc_ok
    Returns None if the frame is structurally invalid.
    """
    if len(data) < 17:
        return None
    if data[0] != FRAME_START or data[1] != FRAME_FIXED:
        return None
    if data[10] != FRAME_START or data[-1] != FRAME_END:
        return None

    cmd = data[11]
    payload_len = (data[12] << 8) | data[13]

    if len(data) != 14 + payload_len + 3:
        return None

    device_id = data[2:10]
    payload = data[14 : 14 + payload_len]
    crc_received = (data[-3] << 8) | data[-2]
    crc_computed = _crc_ccitt(data[: 14 + payload_len])

    return {
        "cmd": cmd,
        "cmd_name": CMD_NAMES.get(cmd, f"0x{cmd:02x}"),
        "device_id": device_id,
        "device_id_hex": device_id.hex().upper(),
        "payload": payload,
        "crc_ok": crc_received == crc_computed,
        "crc_received": crc_received,
        "crc_computed": crc_computed,
    }


# ── Pattern payload decoder ───────────────────────────────────────────────────


def _decode_pattern(payload: bytes) -> tuple[list, bytes]:
    """
    Decode a PATTERN command payload into a list of point dicts and the raw trailer.

    Each point is 12 bytes; the payload ends with a 4-byte trailer whose meaning
    is not yet fully understood (byte[0] may encode repetitions or ball count).
    Returns (points, trailer).
    """
    if len(payload) < 4:
        return [], payload
    points_data = payload[:-4]
    trailer = payload[-4:]
    if len(points_data) % 12 != 0:
        return [], trailer
    points = []
    for i in range(len(points_data) // 12):
        p = points_data[i * 12 : (i + 1) * 12]
        points.append(
            {
                "m1speed": p[0],
                "m2speed": p[1],
                "xaxis": p[2],
                "yaxis": p[3],
                "zaxis": p[4],
                # p[5] is always 0x00
                "times": p[6],  # sequential: ball count; random: 0x01
                # single-point: (int)((19 - app_ballTime) * 3.5), range 0-63; multi-point: 0
                "ball_timing": p[7],
                # single-point: 0; multi-point: raw app ballTime value (1-20)
                "ball_time": p[8],
                "depth": p[9],
                "land_type": p[10],  # 0=sequential, 2=random
                "is_random": p[11],  # 0=sequential, 1=random
            }
        )
    return points, trailer


# ── Robot simulator ───────────────────────────────────────────────────────────


class RobotSimulator:
    def __init__(
        self,
        device_id_hex: str,
        loop: asyncio.AbstractEventLoop,
        drill_duration: float = 0.1,  # seconds until 0x83 (drill-ended); 0 = no auto-end
    ):
        hex_str = device_id_hex.upper().ljust(16, "0")[:16]
        self.device_id_bytes = bytes.fromhex(hex_str)
        self.device_name = f"J-{hex_str}"
        self._loop = loop
        self._drill_duration = drill_duration
        self._drill_task: Optional[asyncio.Task] = None
        self._server: Optional[BlessServer] = None
        self._char: Optional[BlessGATTCharacteristic] = None
        self._rx_buffer = bytearray()
        self.log = logging.getLogger("sim")

    # ── helpers ──

    @staticmethod
    def _hex(data: bytes) -> str:
        return " ".join(f"{b:02x}" for b in data)

    def _notify(self, data: bytes):
        """Send a BLE notification in ≤20-byte MTU chunks."""
        if self._char is None or self._server is None:
            return
        chunk_size = 20
        for offset in range(0, len(data), chunk_size):
            self._char.value = bytearray(data[offset : offset + chunk_size])
            self._server.update_value(SERVICE_UUID, CHAR_UUID)

    def _send_ack(self, cmd: int, payload: bytes = b""):
        frame = _build_frame(self.device_id_bytes, cmd, payload)
        self.log.info("[ACK] cmd=0x%02x  %s", cmd, self._hex(frame))
        self._notify(frame)

    # ── command handlers ──

    def _handle_connect(self, payload: bytes):
        self.log.info("[CMD_CONNECT] payload=%s", payload.hex() or "(empty)")
        self._send_ack(ACK_CONNECT)

    def _handle_pattern(self, payload: bytes, alt: bool):
        tag = "CMD_PATTERN_ALT" if alt else "CMD_PATTERN"
        points, trailer = _decode_pattern(payload)
        self.log.info("[%s] %d point(s)  trailer=%s", tag, len(points), trailer.hex())
        for i, p in enumerate(points):
            self.log.info(
                "  [%d] times=%d  ball_timing=%d  ball_time=%d  depth=%d"
                "  land_type=%d  is_random=%d  m1=%d m2=%d  x=%d y=%d z=%d",
                i,
                p["times"],
                p["ball_timing"],
                p["ball_time"],
                p["depth"],
                p["land_type"],
                p["is_random"],
                p["m1speed"],
                p["m2speed"],
                p["xaxis"],
                p["yaxis"],
                p["zaxis"],
            )
        # 0x81 triggers the "drill running" screen; 0x8f is an error code — do not send it here
        self._send_ack(ACK_DRILL_RUNNING)

        async def _drill_lifecycle():
            try:
                if self._drill_duration > 0:
                    self.log.info("[DRILL] running for %.1f s…", self._drill_duration)
                    await asyncio.sleep(self._drill_duration)
                    self._send_ack(ACK_DRILL_END)  # 0x82 = drill ended
                    self.log.info("[DRILL] done")
            except asyncio.CancelledError:
                pass

        if self._drill_task and not self._drill_task.done():
            self._drill_task.cancel()
        self._drill_task = asyncio.run_coroutine_threadsafe(
            _drill_lifecycle(), self._loop
        )

    def _handle_control(self, payload: bytes):
        sub = payload[0] if payload else None
        if sub == CTRL_STOP:
            self.log.info("[CMD_CONTROL] STOP")
            if self._drill_task and not self._drill_task.done():
                self._drill_task.cancel()
                self._drill_task = None
            self._send_ack(ACK_CONTROL, bytes([0x00]))
            self._send_ack(ACK_DRILL_END)  # 0x82 immediately on stop
        elif sub == CTRL_CALIBRATION:
            self.log.info("[CMD_CONTROL] START_CALIBRATION")
            self._send_ack(ACK_CONTROL, bytes([0x02]))
        else:
            self.log.info("[CMD_CONTROL] payload=%s", payload.hex())

    def _handle_disconnect(self, payload: bytes):
        self.log.info("[CMD_DISCONNECT]")

    def _handle_status(self, payload: bytes):
        self.log.debug("[CMD_STATUS] heartbeat → ACK 0x85")
        self._send_ack(ACK_STATUS, bytes([0x00, 0x01, 0x01, 0x04]))

    def _dispatch(self, frame: dict):
        cmd = frame["cmd"]
        payload = frame["payload"]
        crc_str = (
            "crc=ok"
            if frame["crc_ok"]
            else f"crc=BAD (got 0x{frame['crc_received']:04x} want 0x{frame['crc_computed']:04x})"
        )
        self.log.debug(
            "[FRAME] cmd=0x%02x (%s) payloadLen=%d %s",
            cmd,
            frame["cmd_name"],
            len(payload),
            crc_str,
        )

        if cmd == CMD_CONNECT:
            self._handle_connect(payload)
        elif cmd in (CMD_PATTERN, CMD_PATTERN_ALT):
            self._handle_pattern(payload, alt=(cmd == CMD_PATTERN_ALT))
        elif cmd == CMD_CONTROL:
            self._handle_control(payload)
        elif cmd == CMD_DISCONNECT:
            self._handle_disconnect(payload)
        elif cmd == CMD_STATUS:
            self._handle_status(payload)
        else:
            self.log.warning("[UNKNOWN] cmd=0x%02x payload=%s", cmd, payload.hex())

    # ── BLE write handler ──

    def _on_write(
        self, characteristic: BlessGATTCharacteristic, value: bytearray, **kwargs
    ):
        """Called by bless on every GATT write to the characteristic."""
        data = bytes(value)
        self.log.debug("[RX chunk] %s", self._hex(data))

        # Re-assembly: a chunk starting with FRAME_START resets the buffer
        if data and data[0] == FRAME_START:
            self._rx_buffer = bytearray(data)
        else:
            self._rx_buffer.extend(data)

        # Frame complete when last byte is FRAME_END
        if self._rx_buffer and self._rx_buffer[-1] == FRAME_END:
            raw = bytes(self._rx_buffer)
            self._rx_buffer = bytearray()
            self.log.debug("[RX frame] %s", self._hex(raw))
            parsed = _parse_frame(raw)
            if parsed:
                self._dispatch(parsed)
            else:
                self.log.warning("[RX] Malformed frame: %s", self._hex(raw))

    # ── main lifecycle ──

    async def run(self):
        trigger = asyncio.Event()

        self._server = BlessServer(name=self.device_name, loop=self._loop)
        self._server.write_request_func = self._on_write

        await self._server.add_new_service(SERVICE_UUID)
        await self._server.add_new_characteristic(
            SERVICE_UUID,
            CHAR_UUID,
            GATTCharacteristicProperties.write_without_response
            | GATTCharacteristicProperties.notify,
            None,
            GATTAttributePermissions.writeable,
        )
        self._char = self._server.get_characteristic(CHAR_UUID)

        await self._server.start()
        self.log.info("Advertising as '%s'", self.device_name)
        self.log.info("Service : %s", SERVICE_UUID)
        self.log.info("Char    : %s", CHAR_UUID)
        self.log.info("Waiting for connections… (Ctrl+C to stop)")

        try:
            await trigger.wait()
        except asyncio.CancelledError:
            pass
        finally:
            await self._server.stop()
            self.log.info("Stopped.")


# ── Entry point ───────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Joola Infinity Robot BLE Simulator — advertises as a robot, "
            "logs all incoming commands, sends ACK responses."
        )
    )
    parser.add_argument(
        "--device-id",
        default="0102030405060708",
        metavar="HEX16",
        help="16-char hex device ID (e.g. 00A331D33F040001). Default: 0102030405060708",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show debug output including raw frame hex dumps",
    )
    parser.add_argument(
        "--drill-duration",
        type=float,
        default=0.1,
        metavar="SECONDS",
        help=(
            "How long the drill runs before the simulator sends the drill-ended notification (0x83). "
            "0 = no auto-end (drill runs until the app sends CMD_CONTROL stop). Default: 0.1"
        ),
    )
    args = parser.parse_args()

    logging.basicConfig(
        format="%(asctime)s  %(levelname)-7s  %(message)s",
        datefmt="%H:%M:%S",
        level=logging.DEBUG if args.verbose else logging.INFO,
        stream=sys.stdout,
    )

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    sim = RobotSimulator(args.device_id, loop, drill_duration=args.drill_duration)

    try:
        loop.run_until_complete(sim.run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
