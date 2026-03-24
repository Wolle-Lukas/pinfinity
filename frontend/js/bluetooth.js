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

const CMD_NAMES = {
  [CMD_CONNECT]:     'CONNECT',
  [CMD_DISCONNECT]:  'DISCONNECT',
  [CMD_PATTERN]:     'PATTERN',
  [CMD_STOP]:        'STOP',
  [CMD_CALIBRATION]: 'CALIBRATION',
};

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

  const cmdName = CMD_NAMES[cmdType] ?? `0x${cmdType.toString(16).padStart(2, '0')}`;
  console.debug(`[BT] buildFrame cmd=${cmdName} payloadLen=${len} totalLen=${frame.length} crc=0x${crc.toString(16).padStart(4, '0')} frame=${Array.from(frame).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

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

    console.log('[BT] Requesting Bluetooth device (filter: namePrefix "J-")…');
    this._setStatus('connecting');

    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'J-' }],
        optionalServices: [SERVICE_UUID, ALT_SERVICE_UUID],
      });
      console.log(`[BT] Device selected: "${this.device.name}" (id=${this.device.id})`);

      this.device.addEventListener('gattserverdisconnected', () => {
        console.warn('[BT] GATT server disconnected unexpectedly');
        this._setStatus('disconnected');
      });

      console.log('[BT] Connecting to GATT server…');
      this.server = await this.device.gatt.connect();
      console.log('[BT] GATT server connected');

      // Try primary service first, then alternative
      let service, char;
      try {
        console.debug(`[BT] Trying primary service ${SERVICE_UUID}…`);
        service = await this.server.getPrimaryService(SERVICE_UUID);
        console.debug(`[BT] Primary service found, getting characteristic ${CHAR_UUID}…`);
        char = await service.getCharacteristic(CHAR_UUID);
        console.log('[BT] Using primary service + characteristic');
      } catch (primaryErr) {
        console.warn(`[BT] Primary service unavailable (${primaryErr.message}), falling back to alt service ${ALT_SERVICE_UUID}`);
        service = await this.server.getPrimaryService(ALT_SERVICE_UUID);
        console.debug(`[BT] Alt service found, getting write characteristic ${ALT_CHAR_WRITE}…`);
        char = await service.getCharacteristic(ALT_CHAR_WRITE);
        console.log('[BT] Using alt service + write characteristic');
        // Also set up notifications on the alt notify characteristic
        try {
          console.debug(`[BT] Setting up notifications on alt notify characteristic ${ALT_CHAR_NOTIFY}…`);
          const notifyChar = await service.getCharacteristic(ALT_CHAR_NOTIFY);
          await notifyChar.startNotifications();
          notifyChar.addEventListener('characteristicvaluechanged', (e) => {
            const data = e.target.value;
            console.debug(`[BT] Notification received (alt) len=${data.byteLength} data=${Array.from(new Uint8Array(data.buffer)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            this.onResponse?.(data);
          });
          console.debug('[BT] Alt notify characteristic subscribed');
        } catch (notifyErr) {
          console.warn(`[BT] Alt notifications not available: ${notifyErr.message}`);
        }
      }

      this.characteristic = char;

      // Enable notifications if supported
      if (char.properties.notify) {
        console.debug('[BT] Enabling notifications on write characteristic…');
        await char.startNotifications();
        char.addEventListener('characteristicvaluechanged', (e) => {
          const data = e.target.value;
          console.debug(`[BT] Notification received len=${data.byteLength} data=${Array.from(new Uint8Array(data.buffer)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
          this.onResponse?.(data);
        });
        console.debug('[BT] Notifications enabled');
      } else {
        console.debug('[BT] Characteristic does not support notifications');
      }

      // Extract device ID from name (J-XXXXXXXXXXXXXXXX → first 8 chars of the 16)
      const name = this.device.name || '';
      if (name.startsWith('J-') && name.length >= 10) {
        this.deviceId = name.substring(2, 10);
      }
      console.log(`[BT] Device ID: ${this.deviceId}`);

      // Send handshake
      console.log('[BT] Sending handshake (CMD_CONNECT)…');
      await this._send(CMD_CONNECT, new Uint8Array(0));

      this._setStatus('connected');
      console.log('[BT] Connection established');
    } catch (err) {
      console.error(`[BT] Connection failed: ${err.message}`, err);
      this._setStatus('disconnected');
      throw err;
    }
  }

  async disconnect() {
    console.log('[BT] Disconnecting…');
    if (this.server?.connected) {
      console.debug('[BT] Sending CMD_DISCONNECT frame…');
      await this._send(CMD_DISCONNECT, new Uint8Array(0)).catch((err) => {
        console.warn(`[BT] Failed to send disconnect frame: ${err.message}`);
      });
      this.server.disconnect();
      console.log('[BT] GATT server disconnected');
    } else {
      console.debug('[BT] Already disconnected, skipping disconnect frame');
    }
    this._setStatus('disconnected');
  }

  /**
   * Send a basic drill pattern to the robot and start playing.
   * @param {object} drill - The drill object from the API
   */
  async sendBasicDrill(drill) {
    console.log(`[BT] Sending basic drill: ${drill.points?.length ?? 0} point(s), ball=${drill.ball} spin=${drill.spin} power=${drill.power} ballTime=${drill.ballTime}`);
    const payload = this._encodeBasicPattern(drill);
    console.debug(`[BT] Encoded payload (${payload.length} bytes): ${Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    await this._send(CMD_PATTERN, payload);
  }

  async stop() {
    console.log('[BT] Sending stop command');
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

      console.debug(`[BT]   point[${i}] x=${p.x} y=${p.y} ball=${drill.ball} spin=${drill.spin} power=${drill.power} speed=${speed} landType=${drill.landType} adjustSpin=${drill.adjustSpin} adjustPos=${drill.adjustPosition}`);
    }

    return buf;
  }

  async _send(cmd, payload) {
    if (!this.characteristic) throw new Error('Not connected');
    const cmdName = CMD_NAMES[cmd] ?? `0x${cmd.toString(16).padStart(2, '0')}`;
    const frame = buildFrame(this.deviceId, cmd, payload);

    // BLE has a max write size (usually 20 bytes), chunk if needed
    const MTU = 20;
    const numChunks = Math.ceil(frame.length / MTU);
    console.debug(`[BT] _send cmd=${cmdName} frameLen=${frame.length} chunks=${numChunks}`);
    for (let i = 0; i < frame.length; i += MTU) {
      const chunk = frame.slice(i, Math.min(i + MTU, frame.length));
      const chunkIndex = Math.floor(i / MTU);
      console.debug(`[BT]   chunk[${chunkIndex}/${numChunks}] len=${chunk.length} data=${Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      await this.characteristic.writeValueWithoutResponse(chunk);
    }
    console.debug(`[BT] _send cmd=${cmdName} done`);
  }

  _setStatus(status) {
    console.log(`[BT] Status → ${status}`);
    this.onStatusChange?.(status);
  }
}
