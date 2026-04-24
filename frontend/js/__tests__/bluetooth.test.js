import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cellToPoint, pointToCell, RobotConnection } from '../bluetooth.js';

// ── cellToPoint ──────────────────────────────────────────────

describe('cellToPoint', () => {
  it('maps cellIndex 0 to {x:1, y:2}', () => {
    expect(cellToPoint(0)).toEqual({ x: 1, y: 2 });
  });

  it('maps cellIndex 14 to {x:15, y:2}', () => {
    expect(cellToPoint(14)).toEqual({ x: 15, y: 2 });
  });

  it('always returns y=2 (medium depth) for all valid cells', () => {
    for (let i = 0; i < 15; i++) {
      expect(cellToPoint(i).y).toBe(2);
    }
  });
});

// ── pointToCell ──────────────────────────────────────────────

describe('pointToCell', () => {
  it('maps x=1 to cellIndex 0', () => {
    expect(pointToCell(1, 2)).toBe(0);
  });

  it('maps x=15 to cellIndex 14', () => {
    expect(pointToCell(15, 2)).toBe(14);
  });

  it('returns -1 for x=0 (below range)', () => {
    expect(pointToCell(0, 2)).toBe(-1);
  });

  it('returns -1 for x=16 (above range)', () => {
    expect(pointToCell(16, 2)).toBe(-1);
  });

  it('is the inverse of cellToPoint for all valid cells', () => {
    for (let i = 0; i < 15; i++) {
      const p = cellToPoint(i);
      expect(pointToCell(p.x, p.y)).toBe(i);
    }
  });
});

// ── _parseFrame ──────────────────────────────────────────────

describe('RobotConnection._parseFrame', () => {
  let conn;

  beforeEach(() => {
    conn = new RobotConnection();
  });

  it('returns null for frames shorter than 17 bytes', () => {
    expect(conn._parseFrame(new Uint8Array(16))).toBeNull();
  });

  it('returns null when declared payloadLen does not match actual frame size', () => {
    const frame = new Uint8Array(17);
    frame[12] = 0x00;
    frame[13] = 0x05; // claims 5 payload bytes, but frame has 0
    expect(conn._parseFrame(frame)).toBeNull();
  });

  it('parses a minimal valid frame (zero-length payload)', () => {
    // 14 header + 0 payload + 2 CRC + 1 end = 17 bytes
    const frame = new Uint8Array(17);
    frame[0]  = 0x68; // FRAME_START
    frame[1]  = 0x01; // FRAME_FIXED
    frame[10] = 0x00; // status
    frame[11] = 0x89; // CMD_CONNECT
    frame[12] = 0x00; // payloadLen high
    frame[13] = 0x00; // payloadLen low = 0
    // CRC [14,15] left as 0 — mismatch only triggers a warning, not a rejection
    frame[16] = 0x16; // FRAME_END

    const parsed = conn._parseFrame(frame);
    expect(parsed).not.toBeNull();
    expect(parsed.cmd).toBe(0x89);
    expect(parsed.cmdName).toBe('CONNECT');
    expect(parsed.payloadLen).toBe(0);
    expect(parsed.status).toBe(0x00);
  });

  it('extracts deviceId bytes 2–9 as a hex string', () => {
    const frame = new Uint8Array(17);
    frame[2] = 0xAB;
    frame[3] = 0xCD;
    frame[16] = 0x16;
    const parsed = conn._parseFrame(frame);
    expect(parsed.deviceId.startsWith('abcd')).toBe(true);
  });

  it('parses firmware version response (cmd=0x85, payloadLen=4)', () => {
    // 14 header + 4 payload + 2 CRC + 1 end = 21 bytes
    const frame = new Uint8Array(21);
    frame[11] = 0x85;
    frame[12] = 0x00;
    frame[13] = 0x04;
    frame[14] = 0x01; // ver digits
    frame[15] = 0x02;
    frame[16] = 0x03;
    frame[17] = 0x04;
    frame[20] = 0x16;
    const parsed = conn._parseFrame(frame);
    expect(parsed.firmwareVersion).toBe('12.34');
  });

  it('handles unknown command codes without throwing', () => {
    const frame = new Uint8Array(17);
    frame[11] = 0xFF;
    frame[16] = 0x16;
    const parsed = conn._parseFrame(frame);
    expect(parsed.cmdName).toBe('0xff');
  });

  it('returns payload bytes as a Uint8Array slice', () => {
    // 14 header + 2 payload + 2 CRC + 1 end = 19 bytes
    const frame = new Uint8Array(19);
    frame[13] = 0x02; // payloadLen = 2
    frame[14] = 0xAA;
    frame[15] = 0xBB;
    frame[18] = 0x16;
    const parsed = conn._parseFrame(frame);
    expect(parsed.payload[0]).toBe(0xAA);
    expect(parsed.payload[1]).toBe(0xBB);
  });
});

// ── _onNotification (frame reassembly) ──────────────────────

describe('RobotConnection._onNotification', () => {
  let conn;

  function dv(bytes) {
    return new DataView(new Uint8Array(bytes).buffer);
  }

  function minimalFrame() {
    // 17-byte frame, payloadLen=0
    const f = new Array(17).fill(0);
    f[0]  = 0x68;
    f[16] = 0x16;
    return f;
  }

  beforeEach(() => {
    conn = new RobotConnection();
    conn.onResponse = vi.fn();
  });

  it('processes a complete single-chunk frame and calls onResponse', () => {
    conn._onNotification(dv(minimalFrame()));
    expect(conn.onResponse).toHaveBeenCalledOnce();
  });

  it('reassembles a frame split across two chunks', () => {
    const frame = minimalFrame();
    conn._onNotification(dv(frame.slice(0, 10)));  // first chunk, no FRAME_END
    expect(conn.onResponse).not.toHaveBeenCalled();
    conn._onNotification(dv(frame.slice(10)));     // second chunk, has FRAME_END
    expect(conn.onResponse).toHaveBeenCalledOnce();
  });

  it('reassembles a frame split across three chunks', () => {
    const frame = minimalFrame();
    conn._onNotification(dv(frame.slice(0, 6)));
    conn._onNotification(dv(frame.slice(6, 12)));
    expect(conn.onResponse).not.toHaveBeenCalled();
    conn._onNotification(dv(frame.slice(12)));
    expect(conn.onResponse).toHaveBeenCalledOnce();
  });

  it('resets the buffer when a new FRAME_START arrives mid-stream', () => {
    conn._onNotification(dv([0x01, 0x02, 0x03])); // garbage without FRAME_START
    conn._onNotification(dv(minimalFrame()));       // fresh frame resets and completes
    expect(conn.onResponse).toHaveBeenCalledOnce();
  });

  it('does not call onResponse when _parseFrame returns null (frame too short)', () => {
    // Starts with FRAME_START, ends with FRAME_END, but only 3 bytes → parseFrame → null
    conn._onNotification(dv([0x68, 0x01, 0x16]));
    expect(conn.onResponse).not.toHaveBeenCalled();
  });
});

// ── _lookupMotorParams ───────────────────────────────────────

describe('RobotConnection._lookupMotorParams', () => {
  let conn;

  beforeEach(() => {
    conn = new RobotConnection();
    conn.baseConf = [
      { ball: 1, spin: 0, power: 2, landarea: 3, m1speed: 80, m2speed: 90, xaxis: 40, yaxis: 50, zaxis: 60 },
      { ball: 2, spin: 1, power: 3, landarea: 5, m1speed: 110, m2speed: 120, xaxis: 55, yaxis: 65, zaxis: 75 },
    ];
  });

  it('returns the matching entry', () => {
    const result = conn._lookupMotorParams(1, 0, 2, 3);
    expect(result).not.toBeNull();
    expect(result.m1speed).toBe(80);
    expect(result.m2speed).toBe(90);
  });

  it('returns null when no entry matches', () => {
    expect(conn._lookupMotorParams(9, 9, 9, 9)).toBeNull();
  });

  it('requires all four fields to match (no partial match)', () => {
    // ball/spin/power match but landarea differs
    expect(conn._lookupMotorParams(1, 0, 2, 99)).toBeNull();
  });
});

// ── _encodeBasicPattern ──────────────────────────────────────

describe('RobotConnection._encodeBasicPattern', () => {
  let conn;

  const BASE_CONF = [
    { ball: 1, spin: 0, power: 1, landarea: 1, m1speed: 100, m2speed: 110, xaxis: 50, yaxis: 60, zaxis: 70 },
    { ball: 1, spin: 0, power: 1, landarea: 5, m1speed: 120, m2speed: 130, xaxis: 55, yaxis: 65, zaxis: 75 },
  ];

  function drill(overrides = {}) {
    return {
      ball: 1, spin: 0, power: 1,
      ballTime: 9, times: 3, landType: 0, numType: 1,
      points: [{ x: 1, y: 2 }],
      ...overrides,
    };
  }

  beforeEach(() => {
    conn = new RobotConnection();
    conn.baseConf = BASE_CONF;
  });

  it('returns a buffer of correct size for a single point (12 + 4 bytes)', () => {
    expect(conn._encodeBasicPattern(drill()).length).toBe(16);
  });

  it('returns a buffer of correct size for two points (24 + 4 bytes)', () => {
    const buf = conn._encodeBasicPattern(drill({ points: [{ x: 1, y: 2 }, { x: 5, y: 2 }] }));
    expect(buf.length).toBe(28);
  });

  it('fills motor params from baseConf lookup', () => {
    const buf = conn._encodeBasicPattern(drill());
    expect(buf[0]).toBe(100); // m1speed
    expect(buf[1]).toBe(110); // m2speed
    expect(buf[2]).toBe(50);  // xaxis
    expect(buf[3]).toBe(60);  // yaxis
    expect(buf[4]).toBe(70);  // zaxis
  });

  it('uses zeros for motor params when baseConf entry is missing', () => {
    const buf = conn._encodeBasicPattern(drill({ ball: 99 }));
    expect(buf[0]).toBe(0);
    expect(buf[1]).toBe(0);
    expect(buf[4]).toBe(0);
  });

  it('encodes depth as y−1 in byte 9', () => {
    const buf = conn._encodeBasicPattern(drill({ points: [{ x: 1, y: 3 }] }));
    expect(buf[9]).toBe(2); // y=3 → 3-1=2
  });

  it('encodes ball timing for single-point sequential: byte 7 = (19-ballTime)*3.5, byte 8 = 0', () => {
    // ballTime=9: (19-9)*3.5 = 35
    const buf = conn._encodeBasicPattern(drill({ ballTime: 9 }));
    expect(buf[7]).toBe(35);
    expect(buf[8]).toBe(0);
  });

  it('clamps ball timing to 0 when ballTime >= 20', () => {
    const buf = conn._encodeBasicPattern(drill({ ballTime: 20 }));
    expect(buf[7]).toBe(0);
  });

  it('encodes ball timing for multi-point sequential: byte 7 = 0, byte 8 = ballTime', () => {
    const buf = conn._encodeBasicPattern(drill({ points: [{ x: 1, y: 2 }, { x: 5, y: 2 }], ballTime: 9 }));
    expect(buf[7]).toBe(0);
    expect(buf[8]).toBe(9);
  });

  it('encodes random mode flags correctly', () => {
    const buf = conn._encodeBasicPattern(drill({ landType: 2 }));
    expect(buf[6]).toBe(0x01);  // byte 6 = 0x01 in random mode
    expect(buf[7]).toBe(0x80);  // byte 7 = 0x80 in random mode
    expect(buf[10]).toBe(2);    // landType
    expect(buf[11]).toBe(1);    // isRandom flag
  });

  it('encodes sequential trailer: byte 0 = numType', () => {
    const buf = conn._encodeBasicPattern(drill({ numType: 1 }));
    const off = 12; // 1 point * 12 bytes
    expect(buf[off + 0]).toBe(1);
    expect(buf[off + 1]).toBe(0);
    expect(buf[off + 2]).toBe(0);
    expect(buf[off + 3]).toBe(0);
  });

  it('encodes random trailer: byte 0 = times', () => {
    const buf = conn._encodeBasicPattern(drill({ landType: 2, times: 7 }));
    const off = 12;
    expect(buf[off + 0]).toBe(7);
  });

  it('encodes times in byte 6 for sequential mode', () => {
    const buf = conn._encodeBasicPattern(drill({ times: 5, landType: 0 }));
    expect(buf[6]).toBe(5);
  });
});

// ── connection state ─────────────────────────────────────────

describe('RobotConnection connection state', () => {
  let conn;

  beforeEach(() => {
    conn = new RobotConnection();
  });

  it('starts as disconnected', () => {
    expect(conn.connected).toBe(false);
  });

  it('deviceName is null when no device is set', () => {
    expect(conn.deviceName).toBeNull();
  });

  it('_send throws when not connected', async () => {
    await expect(conn._send(0x89, new Uint8Array([0]))).rejects.toThrow('Not connected');
  });

  it('_setStatus invokes the onStatusChange callback', () => {
    const cb = vi.fn();
    conn.onStatusChange = cb;
    conn._setStatus('connected');
    expect(cb).toHaveBeenCalledWith('connected');
  });

  it('_setStatus does not throw when no callback is set', () => {
    expect(() => conn._setStatus('connecting')).not.toThrow();
  });
});
