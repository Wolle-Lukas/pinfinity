/** API communication layer for the Pinfinity backend. */

const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res;
}

// ── Basic drills ─────────────────────────────────────────────

export async function getBasicList({ patternType = -1, name = '', ball = -1, spin = -1, pageNum = 1, pageSize = 100 } = {}) {
  const params = new URLSearchParams({ patternType, name, ball, spin, pageNum, pageSize });
  return request('GET', `/basic/list?${params}`);
}

export async function getBasicInfo() {
  return request('GET', '/basic/info');
}

export async function getBasicSkillLevels() {
  return request('GET', '/basic/skillLevel');
}

export async function saveBasicDrill(drill) {
  return request('POST', '/basic/save', drill);
}

export async function deleteBasicDrill(id) {
  return request('DELETE', '/basic/delete', { id });
}

export async function setBasicFavourite(id, favourite) {
  return request('POST', '/basic/setFavourite', { id, favourite });
}

// ── Advance drills ───────────────────────────────────────────

export async function getAdvanceList({ patternType = -1, name = '', pageNum = 1, pageSize = 100 } = {}) {
  const params = new URLSearchParams({ patternType, name, pageNum, pageSize });
  return request('GET', `/advance/list?${params}`);
}

export async function saveAdvanceDrill(drill) {
  return request('POST', '/advance/save', drill);
}

export async function deleteAdvanceDrill(id) {
  return request('DELETE', '/advance/delete', { id });
}

export async function setAdvanceFavourite(id, favourite) {
  return request('POST', '/advance/setFavourite', { id, favourite });
}

// ── Config & misc ────────────────────────────────────────────

export async function getBaseConf() {
  return request('GET', '/base/conf?version=0');
}

export async function getUserInfo() {
  return request('GET', '/user/info');
}

export async function logSession(data) {
  return request('POST', '/log', data);
}
