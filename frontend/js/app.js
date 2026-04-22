import * as api from './api.js';
import { RobotConnection, cellToPoint, pointToCell } from './bluetooth.js';

// ── Constants ────────────────────────────────────────────────
const BALL_LABELS  = ['Serve', 'Normal', 'Lob'];
const BALL_SUBS    = ['Flat trajectory, robot behind baseline', 'Everyday rally ball', 'High arcing ball'];
const SPIN_LABELS  = ['Max Topspin', 'Topspin', 'No Spin', 'Backspin', 'Max Backspin'];
const POWER_LABELS = ['Extreme', 'Strong', 'Medium', 'Light'];
const POWER_SUBS   = ['Fastest setting', 'Firm pace', 'Typical rally speed', 'Gentle, great for warm-up'];

// Inline SVG glyphs for summary chips + picker options
const BALL_GLYPHS = {
  0: '<svg width="28" height="14" viewBox="0 0 28 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 10 L26 10"/></svg>',
  1: '<svg width="28" height="14" viewBox="0 0 28 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12 Q14 2 26 12"/></svg>',
  2: '<svg width="28" height="14" viewBox="0 0 28 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 13 Q14 -3 26 13"/></svg>',
};
const SPIN_GLYPHS = {
  0: '<svg width="24" height="22" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="11" r="8"/><path d="M12 3 A8 8 0 0 1 20 11"/><polyline points="17 9 20 11 22 8"/></svg>',
  1: '<svg width="24" height="22" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="11" r="8"/><path d="M12 3 A8 8 0 0 1 18 7"/><polyline points="16 5 18 7 20 5"/></svg>',
  2: '<svg width="24" height="22" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="11" r="8"/></svg>',
  3: '<svg width="24" height="22" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="11" r="8"/><path d="M12 19 A8 8 0 0 1 6 15"/><polyline points="8 17 6 15 4 17"/></svg>',
  4: '<svg width="24" height="22" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="11" r="8"/><path d="M12 19 A8 8 0 0 1 4 11"/><polyline points="7 13 4 11 2 14"/></svg>',
};
const POWER_GLYPHS = {
  0: '<svg width="26" height="20" viewBox="0 0 26 20"><rect x="2" y="2" width="22" height="3" rx="1" fill="currentColor"/><rect x="2" y="8" width="22" height="3" rx="1" fill="currentColor"/><rect x="2" y="14" width="22" height="3" rx="1" fill="currentColor"/></svg>',
  1: '<svg width="26" height="20" viewBox="0 0 26 20"><rect x="2" y="2" width="22" height="3" rx="1" fill="currentColor" opacity=".3"/><rect x="2" y="8" width="22" height="3" rx="1" fill="currentColor"/><rect x="2" y="14" width="22" height="3" rx="1" fill="currentColor"/></svg>',
  2: '<svg width="26" height="20" viewBox="0 0 26 20"><rect x="2" y="2" width="22" height="3" rx="1" fill="currentColor" opacity=".3"/><rect x="2" y="8" width="22" height="3" rx="1" fill="currentColor" opacity=".3"/><rect x="2" y="14" width="22" height="3" rx="1" fill="currentColor"/></svg>',
  3: '<svg width="26" height="20" viewBox="0 0 26 20"><rect x="2" y="2" width="22" height="3" rx="1" fill="currentColor" opacity=".3"/><rect x="2" y="8" width="22" height="3" rx="1" fill="currentColor" opacity=".3"/><rect x="2" y="14" width="8" height="3" rx="1" fill="currentColor"/></svg>',
};

const ICONS = {
  edit:      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  duplicate: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  rename:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  trash:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  star:      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  more:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
};

// ── State ────────────────────────────────────────────────────
const state = {
  view: 'list',
  tab: 'basic',
  drills: [],
  advanceDrills: [],
  searchQuery: '',
  advanceSearchQuery: '',
  filter: { ball: -1, spin: -1, patternType: -1, mode: null, favorite: false },
  // Editor state
  currentDrill: null,
  ball: 1, spin: 2, power: 2,
  mode: 'single',
  points: [],
  undoStack: [],
  ballTime: 9,
  ballCount: 20,
  dirty: false,
  playing: false,
};

const robot = new RobotConnection();
let baseConf = [];

// ── DOM helpers ──────────────────────────────────────────────
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Theme: read from localStorage, default dark
  const storedTheme = localStorage.getItem('pinfinity.theme') || 'dark';
  document.body.dataset.theme = storedTheme;

  // Restore tab before building UI so the correct tab is active from the start
  const savedTab = localStorage.getItem('pinfinity.lastTab');
  if (savedTab && savedTab !== state.tab) setTab(savedTab);

  // If we'll restore an editor session, pre-switch views immediately (before any
  // async work) so the list never flashes on screen.
  const willRestoreEditor = localStorage.getItem('pinfinity.lastView') === 'editor'
    && localStorage.getItem('pinfinity.lastDrillId');
  if (willRestoreEditor) {
    $('#view-list').classList.remove('active');
    $('#view-editor').classList.add('active');
  }

  buildCourt();
  bindEvents();
  setupBluetooth();
  await loadBaseConf();
  await loadDrills();
  restoreLastSession();
}

async function loadBaseConf() {
  try {
    const res = await api.getBaseConf();
    baseConf = res.data || [];
    robot.baseConf = baseConf;
    console.log(`[app] Loaded ${baseConf.length} base-conf entries`);
  } catch (e) {
    console.error('[app] Failed to load base-conf:', e);
  }
}

function isComboAvailable(ball, spin, power) {
  return baseConf.some(e => e.ball === ball && e.spin === spin && e.power === power);
}
function isLandareaAvailable(ball, spin, power, landarea) {
  return baseConf.some(e => e.ball === ball && e.spin === spin && e.power === power && e.landarea === landarea);
}

function pushUndo(what) {
  const snap = {};
  if (what === 'points' || what === 'all') snap.points = state.points.map(p => ({ ...p }));
  if (what === 'settings' || what === 'all') {
    snap.ball = state.ball; snap.spin = state.spin; snap.power = state.power;
  }
  state.undoStack.push(snap);
  $('#btn-undo').disabled = state.undoStack.length === 0;
}

let _pendingApply = null;
function getConflictingPoints(ball, spin, power) {
  return state.points.filter(p => !isLandareaAvailable(ball, spin, power, p.x));
}
function applyWithConflictCheck(newBall, newSpin, newPower, applyFn) {
  const conflicts = getConflictingPoints(newBall, newSpin, newPower);
  if (conflicts.length === 0) {
    pushUndo('settings'); applyFn(); return;
  }
  const n = conflicts.length;
  $('#conflict-message').textContent =
    `${n} placed ball${n > 1 ? 's are' : ' is'} in ${n > 1 ? 'areas' : 'an area'} ` +
    `that won't be reachable with the new setting and will be removed.`;
  _pendingApply = () => {
    pushUndo('all');
    state.points = state.points.filter(p => isLandareaAvailable(newBall, newSpin, newPower, p.x));
    applyFn();
  };
  openOverlay('dialog-conflict');
}

// ── Court ────────────────────────────────────────────────────
function buildCourt() {
  const grid = $('#court');
  for (let i = 0; i < 15; i++) {
    const cell = document.createElement('button');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.setAttribute('aria-label', `Cell ${i + 1}`);
    cell.addEventListener('click', () => onCellClick(i));
    grid.appendChild(cell);
  }
}

function renderCourt() {
  const cells = $$('#court .cell');
  cells.forEach((cell, idx) => {
    const point = cellToPoint(idx);
    const avail = isLandareaAvailable(state.ball, state.spin, state.power, point.x);
    const match = state.points.findIndex(p => p.x === point.x);

    cell.classList.toggle('imp', !avail);
    cell.classList.toggle('on', match !== -1);
    cell.disabled = !avail;
    cell.innerHTML = '';

    if (match !== -1) {
      const lbl = document.createElement('span');
      lbl.className = 'dot-label';
      if (state.mode === 'sequence') lbl.textContent = match + 1;
      else if (state.mode === 'random') lbl.textContent = 'R';
      else lbl.textContent = '●';
      cell.appendChild(lbl);
    }
  });

  $('#btn-clear').disabled = state.points.length === 0;
  const hint = $('#mode-hint');
  if (state.mode === 'single')   hint.textContent = 'Tap one zone. Each shot lands in the same spot.';
  if (state.mode === 'sequence') hint.textContent = 'Tap zones in order. The robot cycles through them.';
  if (state.mode === 'random')   hint.textContent = 'Tap any zones. The robot picks one at random per shot.';
}

function onCellClick(index) {
  const point = cellToPoint(index);
  if (!isLandareaAvailable(state.ball, state.spin, state.power, point.x)) return;

  pushUndo('points');
  if (state.mode === 'single') {
    state.points = [point];
  } else {
    const idx = state.points.findIndex(p => p.x === point.x);
    if (idx !== -1) state.points.splice(idx, 1);
    else state.points.push(point);
  }
  markDirty();
  renderCourt();
}

// ── Event bindings ───────────────────────────────────────────
function bindEvents() {
  // Theme toggle
  $('#btn-theme').addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = next;
    localStorage.setItem('pinfinity.theme', next);
  });

  // Tabs
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    setTab(t.dataset.tab);
    loadDrills();
  }));

  // Search
  $('#search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    $('#search-clear').classList.toggle('hidden', !e.target.value);
    renderDrillList();
  });
  $('#search-clear').addEventListener('click', () => {
    $('#search-input').value = '';
    state.searchQuery = '';
    $('#search-clear').classList.add('hidden');
    renderDrillList();
  });
  $('#advance-search-input').addEventListener('input', (e) => {
    state.advanceSearchQuery = e.target.value;
    renderAdvanceList();
  });

  // Filter chips
  $('#filter-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const g = chip.dataset.group, v = chip.dataset.value;
    if (g === 'ball') {
      const val = parseInt(v);
      state.filter.ball = state.filter.ball === val ? -1 : val;
    } else if (g === 'mode') {
      state.filter.mode = state.filter.mode === v ? null : v;
    } else if (g === 'source') {
      if (v === 'favorite') state.filter.favorite = !state.filter.favorite;
      else {
        const patternValue = v === 'official' ? 0 : 1;
        state.filter.patternType = state.filter.patternType === patternValue ? -1 : patternValue;
      }
    }
    syncFilterChips();
    loadDrills();
  });

  // Filter button → open sheet
  $('#btn-filter').addEventListener('click', () => {
    syncFilterChips();
    $('#filter-sheet').classList.remove('hidden');
  });
  $('#filter-reset').addEventListener('click', () => {
    state.filter = { ball: -1, spin: -1, patternType: -1, mode: null, favorite: false };
    syncFilterChips();
    loadDrills();
  });

  // New drill
  $('#btn-new-drill').addEventListener('click', () => openEditor(null));

  // Back / editor actions
  $('#btn-back').addEventListener('click', () => showView('list'));
  $('#btn-save').addEventListener('click', onSave);
  $('#btn-undo').addEventListener('click', doUndo);

  // Summary chips → picker
  $('#chip-ball').addEventListener('click',  () => openPicker('ball'));
  $('#chip-spin').addEventListener('click',  () => openPicker('spin'));
  $('#chip-power').addEventListener('click', () => openPicker('power'));

  // Segmented mode
  $$('.seg-btn').forEach(b => b.addEventListener('click', () => {
    if (state.mode === b.dataset.mode) return;
    pushUndo('points');
    state.mode = b.dataset.mode;
    state.points = [];
    $$('.seg-btn').forEach((x, i) => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-checked', x === b);
    });
    updateSegIndicator();
    markDirty();
    renderCourt();
  }));

  // Clear court
  $('#btn-clear').addEventListener('click', () => {
    if (state.points.length === 0) return;
    pushUndo('points');
    state.points = [];
    markDirty();
    renderCourt();
  });

  // Timing slider
  $('#timing-slider').addEventListener('input', (e) => {
    state.ballTime = 21 - parseInt(e.target.value);
    $('#timing-value').textContent = state.ballTime;
    markDirty();
  });

  // Ball count
  $('#row-ball-count').addEventListener('click', () => {
    $('#count-input').value = state.ballCount;
    openOverlay('dialog-count');
  });
  $('#count-minus').addEventListener('click', () => {
    const v = Math.max(1, (parseInt($('#count-input').value) || 1) - 1);
    $('#count-input').value = v;
  });
  $('#count-plus').addEventListener('click', () => {
    const v = Math.min(999, (parseInt($('#count-input').value) || 0) + 1);
    $('#count-input').value = v;
  });
  $('#count-confirm').addEventListener('click', () => {
    const v = Math.max(1, Math.min(999, parseInt($('#count-input').value) || 20));
    state.ballCount = v;
    $('#ball-count-value').textContent = v;
    markDirty();
    closeOverlay('dialog-count');
  });

  // Play / test / stop
  $('#btn-test').addEventListener('click', () => onPlay('test'));
  $('#btn-play').addEventListener('click', () => onPlay('play'));
  $('#btn-stop').addEventListener('click', onStop);

  // Robot banner
  $('#robot-banner').addEventListener('click', onRobotBannerClick);

  // Picker
  $('#picker-confirm').addEventListener('click', onPickerConfirm);

  // Save dialog
  $('#save-confirm').addEventListener('click', () => {
    const name = $('#save-name-input').value.trim();
    if (!name) { toast('Enter a drill name'); return; }
    closeOverlay('dialog-save');
    doSave(name);
  });

  // Rename dialog
  $('#rename-confirm').addEventListener('click', onRenameConfirm);

  // Delete dialog
  $('#delete-confirm').addEventListener('click', onDeleteConfirm);

  // Conflict dialog
  $('#conflict-confirm').addEventListener('click', () => {
    closeOverlay('dialog-conflict');
    if (_pendingApply) { _pendingApply(); _pendingApply = null; }
  });

  // Generic close handlers (data-close="<id>")
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-close]');
    if (btn) { closeOverlay(btn.dataset.close); return; }
    // click overlay background
    const overlay = e.target.closest('.sheet-overlay, .dialog-overlay');
    if (overlay && e.target === overlay) closeOverlay(overlay.id);
  });

  // Escape key closes top overlay
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = [...$$('.sheet-overlay, .dialog-overlay')].reverse().find(o => !o.classList.contains('hidden'));
      if (open) closeOverlay(open.id);
    }
  });
}

function updateSegIndicator() {
  const map = { single: 0, sequence: 1, random: 2 };
  const i = map[state.mode] ?? 0;
  const ind = $('.seg-indicator');
  if (ind) ind.style.transform = `translateX(${i * 100}%)`;
}

// ── Views ────────────────────────────────────────────────────
function showView(view) {
  state.view = view;
  $('#view-list').classList.toggle('active', view === 'list');
  $('#view-editor').classList.toggle('active', view === 'editor');
  if (view === 'list') {
    localStorage.removeItem('pinfinity.lastView');
    localStorage.removeItem('pinfinity.lastDrillId');
    loadDrills();
  }
}

function setTab(tab) {
  state.tab = tab;
  localStorage.setItem('pinfinity.lastTab', tab);
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const isBasic = tab === 'basic';
  $('#basic-toolbar').classList.toggle('hidden', !isBasic);
  $('#drill-list').classList.toggle('hidden', !isBasic);
  $('#advance-toolbar').classList.toggle('hidden', isBasic);
  $('#advance-drill-list').classList.toggle('hidden', isBasic);
}

function restoreLastSession() {
  const lastView = localStorage.getItem('pinfinity.lastView');
  const lastDrillId = parseInt(localStorage.getItem('pinfinity.lastDrillId'));
  if (lastView !== 'editor' || !lastDrillId) return;
  const drills = state.tab === 'basic' ? state.drills : state.advanceDrills;
  const drill = drills.find(d => d.id === lastDrillId);
  if (drill) {
    openEditor(drill);
  } else {
    // Drill no longer exists — clear saved state and show list
    localStorage.removeItem('pinfinity.lastView');
    localStorage.removeItem('pinfinity.lastDrillId');
    showView('list');
  }
}

// ── Drill list ───────────────────────────────────────────────
async function loadDrills() {
  try {
    if (state.tab === 'basic') {
      const res = await api.getBasicList({
        ball: state.filter.ball,
        spin: state.filter.spin,
        patternType: state.filter.patternType,
      });
      state.drills = res?.data?.records || [];
      renderDrillList();
    } else {
      const res = await api.getAdvanceList();
      state.advanceDrills = res?.data?.records || [];
      renderAdvanceList();
    }
  } catch (err) {
    toast('Failed to load drills');
    console.error(err);
  }
}

function renderDrillList() {
  const list = $('#drill-list');
  const q = state.searchQuery.toLowerCase();
  let filtered = state.drills.filter(d => !q || d.name.toLowerCase().includes(q));
  if (state.filter.favorite) filtered = filtered.filter(d => d.isFavourite);
  if (state.filter.mode) {
    filtered = filtered.filter(d => {
      const ls = d.landType === 2 ? 'random' : ((d.points?.length ?? 0) > 1 ? 'sequence' : 'single');
      return ls === state.filter.mode;
    });
  }
  // Sort: newest first by updateDate/createDate
  filtered = filtered.slice().sort((a, b) => {
    const ta = new Date(a.updateDate || a.createDate || 0).getTime();
    const tb = new Date(b.updateDate || b.createDate || 0).getTime();
    return tb - ta;
  });

  $('#drill-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'drill' : 'drills'}`;
  $('#drill-empty').classList.toggle('hidden', filtered.length > 0);

  list.innerHTML = filtered.map(d => drillCardHtml(d)).join('');

  // Card click → open editor
  list.querySelectorAll('.drill-card').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.card-action')) return;
      const drill = state.drills.find(d => d.id === parseInt(el.dataset.id));
      if (drill) openEditor(drill);
    });
  });
  list.querySelectorAll('.card-fav').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const drill = state.drills.find(d => d.id === id);
      if (!drill) return;
      const newFav = drill.isFavourite ? 0 : 1;
      try {
        await api.setBasicFavourite(id, newFav);
        drill.isFavourite = newFav;
        renderDrillList();
      } catch { toast('Failed to update favorite'); }
    });
  });
  list.querySelectorAll('.card-more').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      openActionsSheet(state.drills.find(d => d.id === id));
    });
  });
}

function drillCardHtml(d) {
  const isCustom = d.uid && d.uid !== 0;
  const sourceLabel = isCustom ? 'Custom' : 'Official';
  const last = d.lastPlayDateUTC ? `Played ${formatDate(d.lastPlayDateUTC)}`
                                 : `Added ${formatDate(d.createDate)}`;
  const landKind = d.landType === 2 ? 'random' : ((d.points?.length ?? 0) > 1 ? 'sequence' : 'single');
  const modeLabel = landKind === 'random' ? 'Random' : landKind === 'sequence' ? 'Sequence' : 'Single';
  return `
    <div class="drill-card" data-id="${d.id}">
      <div class="mini-court">${miniCourtCellsHtml(d)}</div>
      <div class="drill-body">
        <div class="drill-name-row">
          <span class="drill-name-text">${escapeHtml(d.name)}</span>
        </div>
        <div class="drill-meta">
          <span>${BALL_LABELS[d.ball] || ''}</span>
          <span class="dot">·</span>
          <span>${modeLabel}</span>
          <span class="dot">·</span>
          <span${isCustom ? ' class="meta-custom"' : ''}>${sourceLabel}</span>
          <span class="dot">·</span>
          <span>${last}</span>
        </div>
      </div>
      <div class="drill-right card-action">
        <button class="card-icon-btn card-fav ${d.isFavourite ? 'active' : ''}" data-id="${d.id}" aria-label="Favorite">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${d.isFavourite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <button class="card-icon-btn card-more" data-id="${d.id}" aria-label="More actions">${ICONS.more}</button>
      </div>
    </div>`;
}

function miniCourtCellsHtml(d) {
  // 15 cells, highlight placed points
  const xs = new Set((d.points || []).map(p => p.x));
  const cls = d.landType === 2 ? 'mc-cell on-seq' : 'mc-cell on';
  let out = '';
  for (let i = 1; i <= 15; i++) {
    out += xs.has(i) ? `<span class="${cls}"></span>` : '<span class="mc-cell"></span>';
  }
  return out;
}

function renderAdvanceList() {
  const list = $('#advance-drill-list');
  const q = state.advanceSearchQuery.toLowerCase();
  let filtered = state.advanceDrills.filter(d => !q || d.name.toLowerCase().includes(q));
  filtered = filtered.slice().sort((a, b) => {
    const ta = new Date(a.updateDate || a.createDate || 0).getTime();
    const tb = new Date(b.updateDate || b.createDate || 0).getTime();
    return tb - ta;
  });
  list.innerHTML = filtered.map(d => drillCardHtml(d)).join('');

  // Card click → open editor (same path as basic)
  list.querySelectorAll('.drill-card').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.card-action')) return;
      const drill = state.advanceDrills.find(d => d.id === parseInt(el.dataset.id));
      if (drill) openEditor(drill);
    });
  });
  list.querySelectorAll('.card-fav').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const drill = state.advanceDrills.find(d => d.id === id);
      if (!drill) return;
      const newFav = drill.isFavourite ? 0 : 1;
      try {
        await api.setAdvanceFavourite(id, newFav);
        drill.isFavourite = newFav;
        renderAdvanceList();
      } catch { toast('Failed to update favourite'); }
    });
  });
  list.querySelectorAll('.card-more').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const drill = state.advanceDrills.find(d => d.id === id);
      if (drill) openActionsSheet(drill);
    });
  });
}

function syncFilterChips() {
  $$('#filter-chips .chip').forEach(chip => {
    const g = chip.dataset.group, v = chip.dataset.value;
    let active = false;
    if (g === 'ball') active = state.filter.ball === parseInt(v);
    else if (g === 'mode') active = state.filter.mode === v;
    else if (g === 'source') {
      if (v === 'favorite') active = state.filter.favorite;
      else active = state.filter.patternType === (v === 'official' ? 0 : 1);
    }
    chip.classList.toggle('active', active);
  });

  // Update filter button badge / active state
  let count = 0;
  if (state.filter.ball !== -1) count++;
  if (state.filter.mode) count++;
  if (state.filter.patternType !== -1) count++;
  if (state.filter.favorite) count++;
  const btn = $('#btn-filter');
  const badge = $('#filter-badge');
  if (btn) btn.classList.toggle('has-active', count > 0);
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
}

// ── Drill actions sheet ──────────────────────────────────────
let _actionsDrill = null;
function openActionsSheet(drill) {
  if (!drill) return;
  _actionsDrill = drill;
  const isOfficial = !drill.uid || drill.uid === 0;
  const body = $('#actions-body');
  body.innerHTML = `
    <button class="sheet-action" data-act="edit">${ICONS.edit}<span>Edit</span></button>
    <button class="sheet-action" data-act="duplicate">${ICONS.duplicate}<span>Duplicate</span></button>
    ${isOfficial ? '' : `<button class="sheet-action" data-act="rename">${ICONS.rename}<span>Rename</span></button>`}
    <button class="sheet-action" data-act="favorite">${ICONS.star}<span>${drill.isFavourite ? 'Unfavorite' : 'Favorite'}</span></button>
    ${isOfficial ? '' : `<button class="sheet-action danger" data-act="delete">${ICONS.trash}<span>Delete</span></button>`}
  `;
  body.querySelectorAll('.sheet-action').forEach(b => {
    b.addEventListener('click', () => handleAction(b.dataset.act));
  });
  openOverlay('actions-sheet');
}

async function handleAction(act) {
  const drill = _actionsDrill;
  closeOverlay('actions-sheet');
  if (!drill) return;
  if (act === 'edit') openEditor(drill);
  else if (act === 'duplicate') duplicateDrill(drill);
  else if (act === 'rename') openRename(drill);
  else if (act === 'favorite') {
    try {
      const newFav = drill.isFavourite ? 0 : 1;
      await api.setBasicFavourite(drill.id, newFav);
      drill.isFavourite = newFav;
      renderDrillList();
    } catch { toast('Failed to update favorite'); }
  } else if (act === 'delete') {
    $('#delete-message').textContent = `"${drill.name}" will be permanently removed.`;
    _pendingDelete = drill;
    openOverlay('dialog-delete');
  }
}

async function duplicateDrill(drill) {
  const payload = {
    id: 0,
    name: `${drill.name} (Copy)`,
    ball: drill.ball, spin: drill.spin, power: drill.power,
    landType: drill.landType,
    ballTime: drill.ballTime, numType: drill.numType ?? 1, times: drill.times,
    adjustSpin: drill.adjustSpin ?? 0, adjustPosition: drill.adjustPosition ?? 0,
    points: drill.points ? drill.points.map(p => ({ ...p })) : [],
    isFavourite: 0,
  };
  try {
    await api.saveBasicDrill(payload);
    toast('Duplicated');
    loadDrills();
  } catch { toast('Failed to duplicate'); }
}

let _renameDrill = null;
function openRename(drill) {
  _renameDrill = drill;
  $('#rename-input').value = drill.name;
  openOverlay('dialog-rename');
  setTimeout(() => $('#rename-input').select(), 50);
}
async function onRenameConfirm() {
  const drill = _renameDrill;
  const name = $('#rename-input').value.trim();
  if (!drill || !name) return;
  const payload = {
    id: drill.id, name,
    ball: drill.ball, spin: drill.spin, power: drill.power,
    landType: drill.landType,
    ballTime: drill.ballTime, numType: drill.numType ?? 1, times: drill.times,
    adjustSpin: drill.adjustSpin ?? 0, adjustPosition: drill.adjustPosition ?? 0,
    points: drill.points ? drill.points.map(p => ({ ...p })) : [],
    isFavourite: drill.isFavourite || 0,
  };
  try {
    await api.saveBasicDrill(payload);
    drill.name = name;
    closeOverlay('dialog-rename');
    renderDrillList();
  } catch { toast('Failed to rename'); }
}

let _pendingDelete = null;
async function onDeleteConfirm() {
  const drill = _pendingDelete;
  if (!drill) return;
  try {
    await api.deleteBasicDrill(drill.id);
    _pendingDelete = null;
    closeOverlay('dialog-delete');
    toast('Deleted');
    loadDrills();
  } catch { toast('Failed to delete'); }
}

// ── Editor ───────────────────────────────────────────────────
function openEditor(drill) {
  if (drill) {
    state.currentDrill = { ...drill };
    state.ball  = drill.ball  ?? 1;
    state.spin  = drill.spin  ?? 2;
    state.power = drill.power ?? 2;
    state.points = (drill.points || []).map(p => ({ ...p }));
    state.ballTime = drill.ballTime ?? 9;
    state.ballCount = drill.times ?? 20;
    if (drill.landType === 2) state.mode = 'random';
    else if ((drill.points?.length ?? 0) > 1) state.mode = 'sequence';
    else state.mode = 'single';
  } else {
    state.currentDrill = { id: 0, name: 'New Drill', uid: 0 };
    state.ball = 1; state.spin = 2; state.power = 2;
    state.points = [];
    state.ballTime = 9; state.ballCount = 20;
    state.mode = 'single';
  }
  state.undoStack = [];
  state.dirty = false;
  syncEditorUI();
  if (drill?.id) {
    localStorage.setItem('pinfinity.lastView', 'editor');
    localStorage.setItem('pinfinity.lastDrillId', String(drill.id));
    localStorage.setItem('pinfinity.lastTab', state.tab);
  }
  showView('editor');
}

function syncEditorUI() {
  const d = state.currentDrill;
  $('#drill-name').textContent = d?.name || 'New Drill';
  $('#drill-dirty').classList.toggle('hidden', !state.dirty);

  $('#chip-ball-value').textContent  = BALL_LABELS[state.ball]  || 'Normal';
  $('#chip-spin-value').textContent  = SPIN_LABELS[state.spin]  || 'No Spin';
  $('#chip-power-value').textContent = POWER_LABELS[state.power] || 'Medium';
  $('#chip-ball-glyph').innerHTML  = BALL_GLYPHS[state.ball]  || '';
  $('#chip-spin-glyph').innerHTML  = SPIN_GLYPHS[state.spin]  || '';
  $('#chip-power-glyph').innerHTML = POWER_GLYPHS[state.power] || '';

  $$('.seg-btn').forEach(b => {
    const active = b.dataset.mode === state.mode;
    b.classList.toggle('active', active);
    b.setAttribute('aria-checked', active);
  });
  updateSegIndicator();

  $('#timing-slider').value = 21 - state.ballTime;
  $('#timing-value').textContent = state.ballTime;
  $('#ball-count-value').textContent = state.ballCount;

  $('#btn-undo').disabled = state.undoStack.length === 0;

  renderCourt();
}

function markDirty() {
  state.dirty = true;
  $('#drill-dirty').classList.remove('hidden');
}

function doUndo() {
  if (state.undoStack.length === 0) return;
  const snap = state.undoStack.pop();
  if (snap.points !== undefined) state.points = snap.points;
  if (snap.ball   !== undefined) state.ball   = snap.ball;
  if (snap.spin   !== undefined) state.spin   = snap.spin;
  if (snap.power  !== undefined) state.power  = snap.power;
  syncEditorUI();
}

// ── Picker (ball / spin / power) ─────────────────────────────
let _pickerParam = null;
let _pickerTemp = null;

function openPicker(param) {
  _pickerParam = param;
  const titles = { ball: 'Ball type', spin: 'Spin', power: 'Power' };
  $('#picker-title').textContent = titles[param];
  _pickerTemp = state[param];

  const opts = $('#picker-options');
  opts.innerHTML = '';
  const labels = param === 'ball' ? BALL_LABELS : param === 'spin' ? SPIN_LABELS : POWER_LABELS;
  const glyphs = param === 'ball' ? BALL_GLYPHS : param === 'spin' ? SPIN_GLYPHS : POWER_GLYPHS;
  const subs   = param === 'ball' ? BALL_SUBS   : param === 'power' ? POWER_SUBS : null;

  labels.forEach((label, i) => {
    const combo = {
      ball:  param === 'ball'  ? i : state.ball,
      spin:  param === 'spin'  ? i : state.spin,
      power: param === 'power' ? i : state.power,
    };
    const available = isComboAvailable(combo.ball, combo.spin, combo.power);
    const btn = document.createElement('button');
    btn.className = 'picker-opt';
    btn.dataset.value = i;
    if (_pickerTemp === i) btn.classList.add('sel');
    if (!available) btn.classList.add('imp');
    btn.innerHTML = `
      <span class="po-glyph">${glyphs[i] || ''}</span>
      <span class="po-labels">
        <span class="po-name">${label}</span>
        <span class="po-sub">${available ? (subs ? subs[i] : '') : 'Unavailable with current combo'}</span>
      </span>
      <svg class="po-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    `;
    btn.addEventListener('click', () => {
      if (!available) return;
      _pickerTemp = i;
      opts.querySelectorAll('.picker-opt').forEach(o => o.classList.toggle('sel', parseInt(o.dataset.value) === i));
    });
    opts.appendChild(btn);
  });
  openOverlay('picker');
}

function onPickerConfirm() {
  const param = _pickerParam;
  const val = _pickerTemp;
  closeOverlay('picker');
  if (val == null || val === state[param]) return;

  const newCombo = {
    ball:  param === 'ball'  ? val : state.ball,
    spin:  param === 'spin'  ? val : state.spin,
    power: param === 'power' ? val : state.power,
  };
  applyWithConflictCheck(newCombo.ball, newCombo.spin, newCombo.power, () => {
    state[param] = val;
    markDirty();
    syncEditorUI();
  });
}

// ── Save ─────────────────────────────────────────────────────
async function onSave() {
  const drill = state.currentDrill;
  const isNew = !drill.id || drill.id === 0;
  const suggested = (isNew || (drill.uid && drill.uid !== 0)) ? (drill.name || '')
                                                              : `${drill.name} (Copy)`;
  $('#save-name-input').value = suggested;
  openOverlay('dialog-save');
  setTimeout(() => $('#save-name-input').select(), 50);
}

async function doSave(name) {
  const drill = state.currentDrill;
  const isCustom = drill.uid && drill.uid !== 0;
  const payload = {
    id: isCustom ? drill.id : 0,
    name,
    ball: state.ball, spin: state.spin, power: state.power,
    landType: state.mode === 'random' ? 2 : 0,
    ballTime: state.ballTime,
    numType: 1,
    times: state.ballCount,
    adjustSpin: 0, adjustPosition: 0,
    points: state.points.length > 0 ? state.points : [{ x: 8, y: 2 }],
    isFavourite: drill.isFavourite || 0,
  };
  try {
    const res = await api.saveBasicDrill(payload);
    if (res?.data) {
      state.currentDrill = res.data;
      state.dirty = false;
      syncEditorUI();
      toast('Drill saved');
    }
  } catch { toast('Failed to save drill'); }
}

// ── Play / test / stop ───────────────────────────────────────
function setTrainingActive(active) {
  state.playing = active;
  $('#btn-play').classList.toggle('hidden', active);
  $('#btn-stop').classList.toggle('hidden', !active);
  $('#btn-test').disabled = active;
}

async function onPlay(mode) {
  if (state.points.length === 0) { toast('Place at least one landing point'); return; }
  const drill = buildDrillPayload();
  if (robot.connected) {
    try {
      await robot.sendBasicDrill(drill);
      if (mode === 'play') { setTrainingActive(true); toast('Playing'); }
      else toast('Testing');
    } catch (err) { toast('Failed to send to robot'); console.error(err); }
  } else {
    toast(`${mode === 'test' ? 'Test' : 'Play'}: Connect robot first`);
  }
  try {
    const now = Math.floor(Date.now() / 1000);
    await api.logSession({
      drillType: state.tab, pid: state.currentDrill?.id || 0,
      pname: state.currentDrill?.name || 'Unnamed', ptype: 'pattern',
      tmode: mode, stime: now, etime: now,
      startTime: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    });
  } catch {}
}

async function onStop() {
  setTrainingActive(false);
  if (robot.connected) {
    try { await robot.stop(); toast('Stopped'); }
    catch (err) { toast('Failed to stop robot'); console.error(err); }
  }
}

function buildDrillPayload() {
  return {
    ball: state.ball, spin: state.spin, power: state.power,
    landType: state.mode === 'random' ? 2 : 0,
    ballTime: state.ballTime, times: state.ballCount,
    adjustSpin: 0, adjustPosition: 0,
    points: state.points,
  };
}

// ── Bluetooth UI ─────────────────────────────────────────────
function setupBluetooth() {
  robot.onResponse = (parsed) => {
    if (parsed?.cmd === 0x82 || parsed?.cmd === 0x83) setTrainingActive(false);
  };
  robot.onStatusChange = (status) => {
    const banner = $('#robot-banner');
    banner.classList.toggle('online', status === 'connected');
    banner.classList.toggle('connecting', status === 'connecting');
    if (status === 'connected') {
      $('#robot-name').textContent = robot.deviceName || 'Robot';
      $('#robot-status').textContent = 'Connected · tap to disconnect';
    } else if (status === 'connecting') {
      $('#robot-name').textContent = 'Connecting…';
      $('#robot-status').textContent = 'Please wait';
    } else {
      $('#robot-name').textContent = 'No robot';
      $('#robot-status').textContent = 'Tap to connect';
      setTrainingActive(false);
    }
  };
}

async function onRobotBannerClick() {
  if (robot.connected) {
    if (confirm('Disconnect from robot?')) await robot.disconnect();
  } else {
    try { await robot.connect(); toast('Robot connected'); }
    catch (err) {
      if (err.name !== 'NotFoundError') toast(err.message || 'Connection failed');
    }
  }
}


// ── Overlays ─────────────────────────────────────────────────
function openOverlay(id)  { const el = $(`#${id}`); if (!el) return; el.classList.remove('hidden'); el.setAttribute('aria-hidden','false'); }
function closeOverlay(id) { const el = $(`#${id}`); if (!el) return; el.classList.add('hidden');    el.setAttribute('aria-hidden','true');  }

// ── Utils ────────────────────────────────────────────────────
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays <= 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch { return ''; }
}
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str ?? ''; return d.innerHTML; }
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 2400);
}
