import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBasicList, getBasicInfo, getBasicSkillLevels,
  saveBasicDrill, deleteBasicDrill, setBasicFavourite,
  getAdvanceList, saveAdvanceDrill, deleteAdvanceDrill, setAdvanceFavourite,
  getBaseConf, getUserInfo, logSession,
} from '../api.js';

// ── Helpers ──────────────────────────────────────────────────

function mockFetch({ ok = true, status = 200, body = {}, contentType = 'application/json' } = {}) {
  const res = {
    ok,
    status,
    headers: { get: (h) => (h === 'content-type' ? contentType : null) },
    json: vi.fn().mockResolvedValue(body),
  };
  global.fetch = vi.fn().mockResolvedValue(res);
  return res;
}

function lastCall() {
  return global.fetch.mock.calls[0];
}

function lastUrl()     { return lastCall()[0]; }
function lastOptions() { return lastCall()[1]; }

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── request(): shared behaviour ──────────────────────────────

describe('request() — shared behaviour', () => {
  it('throws when response is not ok (4xx)', async () => {
    mockFetch({ ok: false, status: 404 });
    await expect(getUserInfo()).rejects.toThrow('404');
  });

  it('throws when response is not ok (5xx)', async () => {
    mockFetch({ ok: false, status: 500 });
    await expect(getUserInfo()).rejects.toThrow('500');
  });

  it('error message includes method, path, and status', async () => {
    mockFetch({ ok: false, status: 403 });
    await expect(getUserInfo()).rejects.toThrow('GET /user/info: 403');
  });

  it('returns parsed JSON when content-type is application/json', async () => {
    const payload = { code: 200, data: { id: 1 } };
    mockFetch({ body: payload });
    const result = await getUserInfo();
    expect(result).toEqual(payload);
  });

  it('calls res.json() exactly once for JSON responses', async () => {
    const res = mockFetch();
    await getUserInfo();
    expect(res.json).toHaveBeenCalledOnce();
  });

  it('returns raw response when content-type is not JSON (e.g. zip)', async () => {
    const res = mockFetch({ contentType: 'application/zip' });
    const result = await getBaseConf();  // any function works here
    expect(result).toBe(res);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('sends Content-Type: application/json on every request', async () => {
    mockFetch();
    await getUserInfo();
    expect(lastOptions().headers['Content-Type']).toBe('application/json');
  });

  it('does not include a body for GET requests', async () => {
    mockFetch();
    await getUserInfo();
    expect(lastOptions().body).toBeUndefined();
  });

  it('serialises the body as JSON for POST requests', async () => {
    mockFetch();
    const drill = { id: 0, name: 'Test' };
    await saveBasicDrill(drill);
    expect(lastOptions().body).toBe(JSON.stringify(drill));
  });

  it('serialises the body as JSON for DELETE requests', async () => {
    mockFetch();
    await deleteBasicDrill(42);
    expect(lastOptions().body).toBe(JSON.stringify({ id: 42 }));
  });

  it('propagates fetch network errors (e.g. offline)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getUserInfo()).rejects.toThrow('Failed to fetch');
  });
});

// ── Basic drill functions ────────────────────────────────────

describe('getBasicList', () => {
  it('calls GET /api/basic/list', async () => {
    mockFetch();
    await getBasicList();
    expect(lastOptions().method).toBe('GET');
    expect(lastUrl()).toMatch(/\/api\/basic\/list/);
  });

  it('includes all default query params', async () => {
    mockFetch();
    await getBasicList();
    const url = lastUrl();
    expect(url).toContain('patternType=-1');
    expect(url).toContain('pageNum=1');
    expect(url).toContain('pageSize=100');
  });

  it('passes custom params to the query string', async () => {
    mockFetch();
    await getBasicList({ patternType: 1, name: 'Foo', ball: 2, spin: 3, pageNum: 2, pageSize: 50 });
    const url = lastUrl();
    expect(url).toContain('patternType=1');
    expect(url).toContain('name=Foo');
    expect(url).toContain('ball=2');
    expect(url).toContain('spin=3');
    expect(url).toContain('pageNum=2');
    expect(url).toContain('pageSize=50');
  });
});

describe('getBasicInfo', () => {
  it('calls GET /api/basic/info', async () => {
    mockFetch();
    await getBasicInfo();
    expect(lastOptions().method).toBe('GET');
    expect(lastUrl()).toBe('/api/basic/info');
  });
});

describe('getBasicSkillLevels', () => {
  it('calls GET /api/basic/skillLevel', async () => {
    mockFetch();
    await getBasicSkillLevels();
    expect(lastOptions().method).toBe('GET');
    expect(lastUrl()).toBe('/api/basic/skillLevel');
  });
});

describe('saveBasicDrill', () => {
  it('calls POST /api/basic/save with the drill as body', async () => {
    mockFetch();
    const drill = { id: 0, name: 'X' };
    await saveBasicDrill(drill);
    expect(lastOptions().method).toBe('POST');
    expect(lastUrl()).toBe('/api/basic/save');
    expect(JSON.parse(lastOptions().body)).toEqual(drill);
  });
});

describe('deleteBasicDrill', () => {
  it('calls DELETE /api/basic/delete with {id}', async () => {
    mockFetch();
    await deleteBasicDrill(7);
    expect(lastOptions().method).toBe('DELETE');
    expect(lastUrl()).toBe('/api/basic/delete');
    expect(JSON.parse(lastOptions().body)).toEqual({ id: 7 });
  });
});

describe('setBasicFavourite', () => {
  it('calls POST /api/basic/setFavourite with {id, favourite}', async () => {
    mockFetch();
    await setBasicFavourite(3, 1);
    expect(lastOptions().method).toBe('POST');
    expect(lastUrl()).toBe('/api/basic/setFavourite');
    expect(JSON.parse(lastOptions().body)).toEqual({ id: 3, favourite: 1 });
  });
});

// ── Advance drill functions ──────────────────────────────────

describe('getAdvanceList', () => {
  it('calls GET /api/advance/list', async () => {
    mockFetch();
    await getAdvanceList();
    expect(lastOptions().method).toBe('GET');
    expect(lastUrl()).toMatch(/\/api\/advance\/list/);
  });

  it('includes default query params', async () => {
    mockFetch();
    await getAdvanceList();
    const url = lastUrl();
    expect(url).toContain('patternType=-1');
    expect(url).toContain('pageNum=1');
    expect(url).toContain('pageSize=100');
  });

  it('passes custom params', async () => {
    mockFetch();
    await getAdvanceList({ patternType: 0, name: 'BH', pageNum: 3, pageSize: 20 });
    const url = lastUrl();
    expect(url).toContain('patternType=0');
    expect(url).toContain('name=BH');
    expect(url).toContain('pageNum=3');
    expect(url).toContain('pageSize=20');
  });
});

describe('saveAdvanceDrill', () => {
  it('calls POST /api/advance/save with the drill as body', async () => {
    mockFetch();
    const drill = { id: 0, name: 'Combo' };
    await saveAdvanceDrill(drill);
    expect(lastOptions().method).toBe('POST');
    expect(lastUrl()).toBe('/api/advance/save');
    expect(JSON.parse(lastOptions().body)).toEqual(drill);
  });
});

describe('deleteAdvanceDrill', () => {
  it('calls DELETE /api/advance/delete with {id}', async () => {
    mockFetch();
    await deleteAdvanceDrill(99);
    expect(lastOptions().method).toBe('DELETE');
    expect(lastUrl()).toBe('/api/advance/delete');
    expect(JSON.parse(lastOptions().body)).toEqual({ id: 99 });
  });
});

describe('setAdvanceFavourite', () => {
  it('calls POST /api/advance/setFavourite with {id, favourite}', async () => {
    mockFetch();
    await setAdvanceFavourite(5, 0);
    expect(lastOptions().method).toBe('POST');
    expect(lastUrl()).toBe('/api/advance/setFavourite');
    expect(JSON.parse(lastOptions().body)).toEqual({ id: 5, favourite: 0 });
  });
});

// ── Config & misc functions ──────────────────────────────────

describe('getBaseConf', () => {
  it('calls GET /api/base/conf with version param', async () => {
    mockFetch();
    await getBaseConf();
    expect(lastOptions().method).toBe('GET');
    expect(lastUrl()).toBe('/api/base/conf?version=0');
  });
});

describe('getUserInfo', () => {
  it('calls GET /api/user/info', async () => {
    mockFetch();
    await getUserInfo();
    expect(lastOptions().method).toBe('GET');
    expect(lastUrl()).toBe('/api/user/info');
  });
});

describe('logSession', () => {
  it('calls POST /api/log with the session data as body', async () => {
    mockFetch();
    const data = { drillId: 1, duration: 300 };
    await logSession(data);
    expect(lastOptions().method).toBe('POST');
    expect(lastUrl()).toBe('/api/log');
    expect(JSON.parse(lastOptions().body)).toEqual(data);
  });
});
