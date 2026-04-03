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

// ── CRC-CCITT (polynomial 0x1021, init 0x0000) ─────────────
// Lookup table extracted from the original Joola robot APK
const CRC_TABLE = [
  0, 4129, 8258, 12387, 16516, 20645, 24774, 28903, 33032, 37161, 41290, 45419, 49548, 53677, 57806, 61935,
  4657, 528, 12915, 8786, 21173, 17044, 29431, 25302, 37689, 33560, 45947, 41818, 54205, 50076, 62463, 58334,
  9314, 13379, 1056, 5121, 25830, 29895, 17572, 21637, 42346, 46411, 34088, 38153, 58862, 62927, 50604, 54669,
  13907, 9842, 5649, 1584, 30423, 26358, 22165, 18100, 46939, 42874, 38681, 34616, 63455, 59390, 55197, 51132,
  18628, 22757, 26758, 30887, 2112, 6241, 10242, 14371, 51660, 55789, 59790, 63919, 35144, 39273, 43274, 47403,
  23285, 19156, 31415, 27286, 6769, 2640, 14899, 10770, 56317, 52188, 64447, 60318, 39801, 35672, 47931, 43802,
  27814, 31879, 19684, 23749, 11298, 15363, 3168, 7233, 60846, 64911, 52716, 56781, 44330, 48395, 36200, 40265,
  32407, 28342, 24277, 20212, 15891, 11826, 7761, 3696, 65439, 61374, 57309, 53244, 48923, 44858, 40793, 36728,
  37256, 33193, 45514, 41451, 53516, 49453, 61774, 57711, 4224, 161, 12482, 8419, 20484, 16421, 28742, 24679,
  33721, 37784, 41979, 46042, 49981, 54044, 58239, 62302, 689, 4752, 8947, 13010, 16949, 21012, 25207, 29270,
  46570, 42443, 38312, 34185, 62830, 58703, 54572, 50445, 13538, 9411, 5280, 1153, 29798, 25671, 21540, 17413,
  42971, 47098, 34713, 38840, 59231, 63358, 50973, 55100, 9939, 14066, 1681, 5808, 26199, 30326, 17941, 22068,
  55628, 51565, 63758, 59695, 39368, 35305, 47498, 43435, 22596, 18533, 30726, 26663, 6336, 2273, 14466, 10403,
  52093, 56156, 60223, 64286, 35833, 39896, 43963, 48026, 19061, 23124, 27191, 31254, 2801, 6864, 10931, 14994,
  64814, 60687, 56684, 52557, 48554, 44427, 40424, 36297, 31782, 27655, 23652, 19525, 15522, 11395, 7392, 3265,
  61215, 65342, 53085, 57212, 44955, 49082, 36825, 40952, 28183, 32310, 20053, 24180, 11923, 16050, 3793, 7920,
];

function crcCCITT(data) {
  let crc = 0;
  for (const b of data) {
    crc = (CRC_TABLE[((crc >> 8) ^ b) & 0xFF] ^ (crc << 8)) & 0xFFFF;
  }
  return crc;
}

// ── Hex string to bytes ─────────────────────────────────────
function hexToBytes(hex) {
  const padded = hex.length % 2 ? '0' + hex : hex;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.substr(i * 2, 2), 16);
  }
  return bytes;
}

// ── Frame builder ────────────────────────────────────────────
function buildFrame(deviceId, cmdType, payload) {
  // deviceId: 16-char hex string, hex-decoded to 8 bytes
  const devBytes = hexToBytes(deviceId.padEnd(16, '0').slice(0, 16));
  const len = payload.length;
  // Header: start(1) + fixed(1) + devId(8) + start(1) + cmd(1) + len(2) = 14
  const frame = new Uint8Array(14 + len + 3); // +crc(2) +end(1)
  let i = 0;
  frame[i++] = FRAME_START;
  frame[i++] = FRAME_FIXED;
  frame.set(devBytes, i); i += 8;
  frame[i++] = FRAME_START;
  frame[i++] = cmdType & 0xFF;
  frame[i++] = (len >> 8) & 0xFF;  // length high byte (big-endian)
  frame[i++] = len & 0xFF;         // length low byte
  frame.set(payload, i); i += len;
  const crc = crcCCITT(frame.subarray(0, i));
  frame[i++] = (crc >> 8) & 0xFF;   // CRC high byte (big-endian)
  frame[i++] = crc & 0xFF;           // CRC low byte
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
    this.deviceId = '0000000000000000';
    this.onStatusChange = null;  // callback(status: 'connected'|'disconnected'|'connecting')
    this.onResponse = null;      // callback(parsedFrame: object)
    this._rxBuffer = [];         // accumulates incoming notification bytes
    this._rxComplete = false;
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
            this._onNotification(e.target.value);
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
          this._onNotification(e.target.value);
        });
        console.debug('[BT] Notifications enabled');
      } else {
        console.debug('[BT] Characteristic does not support notifications');
      }

      // Extract device ID from name (J-XXXXXXXXXXXXXXXX → full 16 hex chars, decoded to 8 bytes)
      const name = this.device.name || '';
      if (name.startsWith('J-') && name.length >= 18) {
        this.deviceId = name.substring(2, 18);
      } else if (name.startsWith('J-')) {
        this.deviceId = name.substring(2).padEnd(16, '0');
      }
      console.log(`[BT] Device ID: ${this.deviceId}`);

      // Send handshake
      console.log('[BT] Sending handshake (CMD_CONNECT)…');
      await this._send(CMD_CONNECT, new Uint8Array([0]));

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
      await this._send(CMD_DISCONNECT, new Uint8Array([0])).catch((err) => {
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
    // Each ball position is encoded as 12 bytes, plus 4 trailing bytes
    const points = drill.points || [];
    const buf = new Uint8Array((points.length * 12) + 4);

    for (let i = 0; i < points.length; i++) {
      const off = i * 12;
      const p = points[i];

      // Bytes 0-4: motor/axis config
      buf[off + 0] = drill.ball & 0xFF;
      buf[off + 1] = drill.spin & 0xFF;
      buf[off + 2] = drill.power & 0xFF;
      buf[off + 3] = drill.landType & 0xFF;
      buf[off + 4] = 0;

      // Bytes 5-6: speed (big-endian)
      const speed = drill.ballTime || 9;
      buf[off + 5] = (speed >> 8) & 0xFF;
      buf[off + 6] = speed & 0xFF;

      // Byte 7: spin parameter
      buf[off + 7] = drill.spin & 0xFF;

      // Byte 8: position X
      buf[off + 8] = (p.x & 0xFF);

      // Byte 9: position Y / depth
      buf[off + 9] = (p.y & 0xFF);

      // Bytes 10-11: additional params
      buf[off + 10] = (drill.adjustSpin ?? 0) & 0xFF;
      buf[off + 11] = (drill.adjustPosition ?? 0) & 0xFF;

      console.debug(`[BT]   point[${i}] x=${p.x} y=${p.y} ball=${drill.ball} spin=${drill.spin} power=${drill.power} speed=${speed} landType=${drill.landType} adjustSpin=${drill.adjustSpin} adjustPos=${drill.adjustPosition}`);
    }

    // 4 trailing bytes (drill-level flags, matching APK defaults)
    const trailerOff = points.length * 12;
    buf[trailerOff + 0] = 1;  // E
    buf[trailerOff + 1] = 1;  // F
    buf[trailerOff + 2] = 0;  // G
    buf[trailerOff + 3] = 0;  // H

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

  // ── Response reassembly & parsing ──────────────────────────

  _onNotification(dataView) {
    const chunk = new Uint8Array(dataView.buffer);
    console.debug(`[BT] Notification chunk len=${chunk.length} data=${Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

    const first = chunk[0];
    const last = chunk[chunk.length - 1];

    // Frame start: clear buffer and begin accumulation
    if (first === FRAME_START) {
      this._rxBuffer = [];
      this._rxComplete = false;
      for (const b of chunk) this._rxBuffer.push(b);
      if (last === FRAME_END) this._rxComplete = true;
    } else if (last === FRAME_END) {
      for (const b of chunk) this._rxBuffer.push(b);
      this._rxComplete = true;
    } else {
      for (const b of chunk) this._rxBuffer.push(b);
    }

    if (!this._rxComplete) return;

    const frame = new Uint8Array(this._rxBuffer);
    this._rxBuffer = [];
    this._rxComplete = false;

    console.debug(`[BT] Complete response frame (${frame.length} bytes): ${Array.from(frame).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

    const parsed = this._parseFrame(frame);
    if (parsed) {
      this.onResponse?.(parsed);
    }
  }

  _parseFrame(frame) {
    // Minimum frame: 14 header + 2 CRC + 1 end = 17 bytes
    if (frame.length < 17) {
      console.warn(`[BT] Response frame too short (${frame.length} bytes)`);
      return null;
    }

    const payloadLen = (frame[12] << 8) | frame[13]; // big-endian length
    if (frame.length - 17 !== payloadLen) {
      console.warn(`[BT] Response frame length mismatch: expected ${payloadLen + 17}, got ${frame.length}`);
      return null;
    }

    // Extract fields
    const deviceId = Array.from(frame.subarray(2, 10)).map(b => b.toString(16).padStart(2, '0')).join('');
    const cmd = frame[11];
    const cmdName = CMD_NAMES[cmd & 0xFF] ?? `0x${(cmd & 0xFF).toString(16).padStart(2, '0')}`;
    const payload = frame.subarray(14, 14 + payloadLen);
    const crcReceived = (frame[frame.length - 3] << 8) | frame[frame.length - 2];
    const crcData = frame.subarray(0, 14 + payloadLen);
    const crcComputed = crcCCITT(crcData);

    if (crcReceived !== crcComputed) {
      console.warn(`[BT] Response CRC mismatch: received=0x${crcReceived.toString(16).padStart(4, '0')} computed=0x${crcComputed.toString(16).padStart(4, '0')}`);
    }

    const status = frame[10];
    const parsed = { cmd, cmdName, status, deviceId, payloadLen, payload };
    console.log(`[BT] Response: cmd=${cmdName} status=0x${status.toString(16).padStart(2, '0')} payloadLen=${payloadLen} crcOk=${crcReceived === crcComputed}`);

    // Version info (status byte 0x85 = -123 signed)
    if ((frame[11] & 0xFF) === 0x85 && payloadLen === 4) {
      const ver = `${payload[0]}${payload[1]}.${payload[2]}${payload[3]}`;
      console.log(`[BT] Robot firmware version: ${ver}`);
      parsed.firmwareVersion = ver;
    }

    return parsed;
  }

  _setStatus(status) {
    console.log(`[BT] Status → ${status}`);
    this.onStatusChange?.(status);
  }
}
