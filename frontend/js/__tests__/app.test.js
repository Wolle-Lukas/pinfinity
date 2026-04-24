// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api.js', () => ({
  logSession: vi.fn().mockResolvedValue({}),
  getBasicList: vi.fn().mockResolvedValue([]),
  getAdvanceList: vi.fn().mockResolvedValue([]),
  getBaseConf: vi.fn().mockResolvedValue([]),
  getUserInfo: vi.fn().mockResolvedValue({}),
  getBasicInfo: vi.fn().mockResolvedValue({}),
  getBasicSkillLevels: vi.fn().mockResolvedValue([]),
  saveBasicDrill: vi.fn().mockResolvedValue({}),
  deleteBasicDrill: vi.fn().mockResolvedValue({}),
  setBasicFavourite: vi.fn().mockResolvedValue({}),
  saveAdvanceDrill: vi.fn().mockResolvedValue({}),
  deleteAdvanceDrill: vi.fn().mockResolvedValue({}),
  setAdvanceFavourite: vi.fn().mockResolvedValue({}),
}));

vi.mock('../bluetooth.js', () => ({
  RobotConnection: vi.fn().mockImplementation(() => ({
    connected: false,
    sendBasicDrill: vi.fn().mockResolvedValue({}),
    onStatusChange: null,
    onResponse: null,
    baseConf: [],
  })),
  cellToPoint: vi.fn((i) => ({ x: i + 1, y: 2 })),
  pointToCell: vi.fn(),
}));

import * as apiModule from '../api.js';
import { onPlay, state } from '../app.js';

describe('onPlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="toast"></div>';
    state.points = [{ x: 5, y: 2 }];
  });

  it('does not log session when robot is not connected', async () => {
    await onPlay('play');
    expect(apiModule.logSession).not.toHaveBeenCalled();
  });

  it('shows a toast when robot is not connected', async () => {
    await onPlay('play');
    expect(document.querySelector('#toast').textContent).toBe('Play: Connect robot first');
  });
});
