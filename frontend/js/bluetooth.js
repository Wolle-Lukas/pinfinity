/**
 * Web Bluetooth communication with the Joola Infinity table tennis robot.
 * Uses BLE GATT with a proprietary frame format.
 */

// ── BLE UUIDs ────────────────────────────────────────────────
const SERVICE_UUID     = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHAR_UUID        = '0000ffe1-0000-1000-8000-00805f9b34fb';
const ALT_SERVICE_UUID = '0000fee7-0000-1000-8000-00805f9b34fb';
const ALT_CHAR_WRITE   = '0000fec8-0000-1000-8000-00805f9b34fb';
const ALT_CHAR_NOTIFY  = '0000fec7-0000-1000-8000-00805f9b34fb';

// ── Frame constants ──────────────────────────────────────────
const FRAME_START = 0x68;
const FRAME_END   = 0x16;
const FRAME_FIXED = 0x01;

// ── Command IDs ──────────────────────────────────────────────
const CMD_CONNECT     = 0x89;
const CMD_DISCONNECT  = 0x99;
const CMD_PATTERN     = 0x01;
const CMD_STOP        = 0x05;
const CMD_CALIBRATION = 0x03;

// ── Grid position mapping ────────────────────────────────────
// x is the cell number 1–15, directly mapping to cells A1–A15 in
// the 3×5 visual grid (row 0: A1–A5, row 1: A6–A10, row 2: A11–A15).
// y is a robot depth parameter (1=short, 2=medium, 3=long) and does
// NOT determine the visual row — it is sent directly to the robot.

export function cellToPoint(cellIndex) {
  return { x: cellIndex + 1, y: 2 }; // default depth: medium (2)
}

export function pointToCell(x, y) {
  const cellIndex = x - 1;
  if (cellIndex < 0 || cellIndex > 14) return -1;
  return cellIndex;
}

// ── CRC-16 ───────────────────────────────────────────────────
function crc16(data) {
  let crc = 0xFFFF;
  for (const b of data) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
    }
  }
  return crc & 0xFFFF;
}

// ── Frame builder ────────────────────────────────────────────
function buildFrame(deviceId, cmdType, payload) {
  // deviceId: 8-char string, payload: Uint8Array
  const devBytes = new TextEncoder().encode(deviceId.padEnd(8, '\0').slice(0, 8));
  const len = payload.length;
  // Header: start(1) + fixed(1) + devId(8) + start(1) + cmd(1) + len(2) = 14
  const frame = new Uint8Array(14 + len + 3); // +crc(2) +end(1)
  let i = 0;
  frame[i++] = FRAME_START;
  frame[i++] = FRAME_FIXED;
  frame.set(devBytes, i); i += 8;
  frame[i++] = FRAME_START;
  frame[i++] = cmdType & 0xFF;
  frame[i++] = len & 0xFF;         // length low byte
  frame[i++] = (len >> 8) & 0xFF;  // length high byte
  frame.set(payload, i); i += len;
  const crc = crc16(frame.subarray(0, i));
  frame[i++] = crc & 0xFF;
  frame[i++] = (crc >> 8) & 0xFF;
  frame[i++] = FRAME_END;
  return frame;
}

// ── Robot connection class ───────────────────────────────────
export class RobotConnection {
  constructor() {
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.deviceId = '00000000';
    this.onStatusChange = null;  // callback(status: 'connected'|'disconnected'|'connecting')
    this.onResponse = null;      // callback(data: DataView)
  }

  get connected() {
    return this.server?.connected ?? false;
  }

  get deviceName() {
    return this.device?.name ?? null;
  }

  async connect() {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome or Edge.');
    }

    this._setStatus('connecting');

    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'J-' }],
        optionalServices: [SERVICE_UUID, ALT_SERVICE_UUID],
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this._setStatus('disconnected');
      });

      this.server = await this.device.gatt.connect();

      // Try primary service first, then alternative
      let service, char;
      try {
        service = await this.server.getPrimaryService(SERVICE_UUID);
        char = await service.getCharacteristic(CHAR_UUID);
      } catch {
        service = await this.server.getPrimaryService(ALT_SERVICE_UUID);
        char = await service.getCharacteristic(ALT_CHAR_WRITE);
        // Also set up notifications on the alt notify characteristic
        try {
          const notifyChar = await service.getCharacteristic(ALT_CHAR_NOTIFY);
          await notifyChar.startNotifications();
          notifyChar.addEventListener('characteristicvaluechanged', (e) => {
            this.onResponse?.(e.target.value);
          });
        } catch { /* notifications optional */ }
      }

      this.characteristic = char;

      // Enable notifications if supported
      if (char.properties.notify) {
        await char.startNotifications();
        char.addEventListener('characteristicvaluechanged', (e) => {
          this.onResponse?.(e.target.value);
        });
      }

      // Extract device ID from name (J-XXXXXXXXXXXXXXXX → first 8 chars of the 16)
      const name = this.device.name || '';
      if (name.startsWith('J-') && name.length >= 10) {
        this.deviceId = name.substring(2, 10);
      }

      // Send handshake
      await this._send(CMD_CONNECT, new Uint8Array(0));

      this._setStatus('connected');
    } catch (err) {
      this._setStatus('disconnected');
      throw err;
    }
  }

  async disconnect() {
    if (this.server?.connected) {
      await this._send(CMD_DISCONNECT, new Uint8Array(0)).catch(() => {});
      this.server.disconnect();
    }
    this._setStatus('disconnected');
  }

  /**
   * Send a basic drill pattern to the robot and start playing.
   * @param {object} drill - The drill object from the API
   */
  async sendBasicDrill(drill) {
    const payload = this._encodeBasicPattern(drill);
    await this._send(CMD_PATTERN, payload);
  }

  async stop() {
    await this._send(CMD_STOP, new Uint8Array(0));
  }

  // ── Internal ─────────────────────────────────────────────

  _encodeBasicPattern(drill) {
    // Each ball position is encoded as 12 bytes
    const points = drill.points || [];
    const buf = new Uint8Array(points.length * 12);

    for (let i = 0; i < points.length; i++) {
      const off = i * 12;
      const p = points[i];

      // Bytes 0-4: ball config (ball type, spin parts)
      buf[off + 0] = drill.ball & 0xFF;
      buf[off + 1] = drill.spin & 0xFF;
      buf[off + 2] = drill.power & 0xFF;
      buf[off + 3] = drill.landType & 0xFF;
      buf[off + 4] = 0;

      // Bytes 5-6: speed/position (little-endian)
      const speed = drill.ballTime || 9;
      buf[off + 5] = speed & 0xFF;
      buf[off + 6] = (speed >> 8) & 0xFF;

      // Byte 7: spin parameter
      buf[off + 7] = drill.spin & 0xFF;

      // Byte 8: position
      buf[off + 8] = (p.x & 0xFF);

      // Byte 9: y position / type
      buf[off + 9] = (p.y & 0xFF);

      // Bytes 10-11: additional params
      buf[off + 10] = drill.adjustSpin & 0xFF;
      buf[off + 11] = drill.adjustPosition & 0xFF;
    }

    return buf;
  }

  async _send(cmd, payload) {
    if (!this.characteristic) throw new Error('Not connected');
    const frame = buildFrame(this.deviceId, cmd, payload);

    // BLE has a max write size (usually 20 bytes), chunk if needed
    const MTU = 20;
    for (let i = 0; i < frame.length; i += MTU) {
      const chunk = frame.slice(i, Math.min(i + MTU, frame.length));
      await this.characteristic.writeValueWithoutResponse(chunk);
    }
  }

  _setStatus(status) {
    this.onStatusChange?.(status);
  }
}
