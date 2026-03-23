import * as api from './api.js';
import { RobotConnection, cellToPoint, pointToCell } from './bluetooth.js';

// ── Constants ────────────────────────────────────────────────
const BALL_LABELS  = ['Serve', 'Normal', 'Lob'];
const SPIN_LABELS  = ['Max Topspin', 'Topspin', 'No Spin', 'Backspin', 'Max Backspin'];
const POWER_LABELS = ['Extreme', 'Strong', 'Medium', 'Light'];
const CELL_NAMES   = ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','A12','A13','A14','A15'];

// ── State ────────────────────────────────────────────────────
const state = {
  view: 'list',         // 'list' | 'editor'
  tab: 'basic',         // 'basic' | 'advance'
  drills: [],           // loaded drill list
  searchQuery: '',
  filter: { ball: -1, spin: -1, patternType: -1 },
  // Editor state
  currentDrill: null,   // full drill object being edited
  ball: 1,
  spin: 2,
  power: 2,
  mode: 'single',       // 'single' | 'sequence' | 'random'
  points: [],           // [{x, y}] selected landing points
  ballTime: 9,
  ballCount: 20,
  dirty: false,
};

const robot = new RobotConnection();

// ── DOM refs ─────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

function init() {
  buildGrid();
  bindEvents();
  setupBluetooth();
  loadDrills();
}

// ── Grid builder ─────────────────────────────────────────────
function buildGrid() {
  const grid = $('#table-grid');
  for (let i = 0; i < 15; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.index = i;
    cell.innerHTML = `<span class="grid-cell-label">${CELL_NAMES[i]}</span>`;
    cell.addEventListener('click', () => onCellClick(i));
    grid.appendChild(cell);
  }
}

// ── Event bindings ───────────────────────────────────────────
function bindEvents() {
  // Tabs
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    state.tab = t.dataset.tab;
    $$('.tab').forEach(x => x.classList.toggle('active', x === t));
    // Filter only applies to basic tab
    state.filter = { ball: -1, spin: -1, patternType: -1 };
    updateFilterBadge();
    $('#btn-filter').classList.toggle('hidden', state.tab === 'advance');
    loadDrills();
  }));

  // Filter
  $('#btn-filter').addEventListener('click', () => openFilterSheet());

  // Search
  $('#search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderDrillList();
  });

  // New drill
  $('#btn-new-drill').addEventListener('click', () => {
    openEditor(null);
  });

  // Back button
  $('#btn-back').addEventListener('click', () => showView('list'));

  // Editor header
  $('#btn-reset').addEventListener('click', resetEditor);
  $('#btn-save').addEventListener('click', onSave);

  // Settings buttons
  $('#btn-ball').addEventListener('click', () => openDialog('dialog-ball'));
  $('#btn-spin').addEventListener('click', () => openDialog('dialog-spin'));
  $('#btn-power').addEventListener('click', () => openDialog('dialog-power'));

  // Mode buttons
  $$('.mode-btn').forEach(b => b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    state.points = [];
    $$('.mode-btn').forEach(x => x.classList.toggle('active', x === b));
    renderGrid();
  }));

  // Grid actions
  $('#btn-undo').addEventListener('click', () => {
    state.points.pop();
    renderGrid();
  });
  $('#btn-clear').addEventListener('click', () => {
    state.points = [];
    renderGrid();
  });

  // Timing slider
  $('#timing-slider').addEventListener('input', (e) => {
    state.ballTime = parseInt(e.target.value);
    $('#timing-value').textContent = state.ballTime;
  });

  // Ball count
  $('#row-ball-count').addEventListener('click', () => openDialog('dialog-count'));

  // Action buttons
  $('#btn-test').addEventListener('click', () => onPlay('test'));
  $('#btn-play').addEventListener('click', () => onPlay('play'));

  // Robot banner
  $('#robot-banner').addEventListener('click', onRobotBannerClick);

  // Dialog events
  setupDialogs();
}

// ── Views ────────────────────────────────────────────────────
function showView(view) {
  state.view = view;
  $('#view-list').classList.toggle('active', view === 'list');
  $('#view-editor').classList.toggle('active', view === 'editor');
  $('#btn-back').classList.toggle('hidden', view === 'list');
  $('#tabs').classList.toggle('hidden', view === 'editor');

  if (view === 'list') {
    $('#header-title').textContent = 'Pinfinity';
    loadDrills();
  } else {
    $('#header-title').textContent = state.tab === 'basic' ? 'Basic Training' : 'Advance Training';
  }
}

// ── Drill List ───────────────────────────────────────────────
async function loadDrills() {
  try {
    let res;
    if (state.tab === 'basic') {
      res = await api.getBasicList({
        ball: state.filter.ball,
        spin: state.filter.spin,
        patternType: state.filter.patternType,
      });
    } else {
      res = await api.getAdvanceList();
    }
    state.drills = res?.data?.records || [];
    renderDrillList();
  } catch (err) {
    toast('Failed to load drills');
    console.error(err);
  }
}

function renderDrillList() {
  const list = $('#drill-list');
  const q = state.searchQuery.toLowerCase();
  const filtered = state.drills.filter(d => !q || d.name.toLowerCase().includes(q));

  $('#drill-count').textContent = `${filtered.length} Results`;

  list.innerHTML = filtered.map(d => {
    const isCustom = d.uid && d.uid !== 0;
    const meta = isCustom ? 'Custom' : 'Official';
    const lastPlayed = d.lastPlayDateUTC ? formatDate(d.lastPlayDateUTC) : '';
    const favClass = d.isFavourite ? 'active' : '';

    return `
      <div class="drill-card" data-id="${d.id}">
        <div class="drill-card-info" data-id="${d.id}">
          <div class="drill-card-title">${escapeHtml(d.name)}</div>
          <div class="drill-card-meta">
            <span>${meta}</span>
            ${lastPlayed ? `<span>Played ${lastPlayed}</span>` : ''}
          </div>
        </div>
        <button class="drill-card-fav ${favClass}" data-id="${d.id}" data-fav="${d.isFavourite}" aria-label="Favourite">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="${d.isFavourite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>`;
  }).join('');

  // Card click → open editor
  list.querySelectorAll('.drill-card-info').forEach(el => {
    el.addEventListener('click', () => {
      const drill = state.drills.find(d => d.id === parseInt(el.dataset.id));
      if (drill) openEditor(drill);
    });
  });

  // Favourite toggle
  list.querySelectorAll('.drill-card-fav').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const newFav = btn.dataset.fav === '1' ? 0 : 1;
      try {
        if (state.tab === 'basic') {
          await api.setBasicFavourite(id, newFav);
        } else {
          await api.setAdvanceFavourite(id, newFav);
        }
        const drill = state.drills.find(d => d.id === id);
        if (drill) drill.isFavourite = newFav;
        renderDrillList();
      } catch {
        toast('Failed to update favourite');
      }
    });
  });
}

// ── Editor ───────────────────────────────────────────────────
function openEditor(drill) {
  if (drill) {
    state.currentDrill = { ...drill };
    state.ball = drill.ball ?? 1;
    state.spin = drill.spin ?? 0;
    state.power = drill.power ?? 1;
    state.points = (drill.points || []).map(p => ({ ...p }));
    state.ballTime = drill.ballTime ?? 9;
    state.ballCount = drill.times ?? 20;

    // Determine mode from points
    if (state.points.length <= 1) {
      state.mode = 'single';
    } else if (drill.landType === 2) {
      state.mode = 'random';
    } else {
      state.mode = 'sequence';
    }
  } else {
    // New drill
    state.currentDrill = { id: 0, name: 'New Drill', uid: 0 };
    state.ball = 1;
    state.spin = 0;
    state.power = 1;
    state.points = [];
    state.ballTime = 9;
    state.ballCount = 20;
    state.mode = 'single';
  }

  state.dirty = false;
  syncEditorUI();
  showView('editor');
}

function syncEditorUI() {
  const d = state.currentDrill;
  $('#drill-name').textContent = d?.name || 'New Drill';

  // Ball / Spin / Power
  $('#ball-value').textContent = BALL_LABELS[state.ball] || 'Normal';
  $('#spin-value').textContent = SPIN_LABELS[state.spin] || 'No Spin';
  $('#power-value').textContent = POWER_LABELS[state.power] || 'Medium';

  updateBallVisual();
  updatePowerVisual();

  // Mode
  $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));

  // Timing
  $('#timing-slider').value = state.ballTime;
  $('#timing-value').textContent = state.ballTime;

  // Ball count
  $('#ball-count-value').textContent = `${state.ballCount} Balls ›`;

  renderGrid();
}

function renderGrid() {
  const cells = $$('.grid-cell');
  cells.forEach((cell, idx) => {
    const cellPoint = cellToPoint(idx);
    const marker = cell.querySelector('.grid-cell-marker');
    if (marker) marker.remove();

    // Find if this cell has a selected point (match by x only;
    // y is a robot depth parameter, not a visual row indicator)
    let matchIndex = -1;
    for (let i = 0; i < state.points.length; i++) {
      if (state.points[i].x === cellPoint.x) {
        matchIndex = i;
        break;
      }
    }

    cell.classList.toggle('active', matchIndex !== -1);

    if (matchIndex !== -1) {
      const m = document.createElement('div');
      m.className = 'grid-cell-marker';
      if (state.mode === 'random') {
        m.textContent = 'R';
      } else if (state.mode === 'sequence') {
        m.textContent = matchIndex + 1;
      } else {
        m.textContent = '';
        m.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>';
      }
      cell.appendChild(m);
    }
  });

  // Show/hide grid actions
  $('#grid-actions').style.display = state.points.length > 0 ? 'flex' : 'none';
}

function onCellClick(index) {
  const point = cellToPoint(index);

  if (state.mode === 'single') {
    // Single mode: replace any existing point
    state.points = [point];
  } else {
    // Sequence / Random: toggle cell
    const existingIdx = state.points.findIndex(p => p.x === point.x);
    if (existingIdx !== -1) {
      state.points.splice(existingIdx, 1);
    } else {
      state.points.push(point);
    }
  }

  state.dirty = true;
  renderGrid();
}

function resetEditor() {
  if (state.currentDrill?.id) {
    const original = state.drills.find(d => d.id === state.currentDrill.id);
    if (original) {
      openEditor(original);
      return;
    }
  }
  state.points = [];
  state.ball = 1;
  state.spin = 0;
  state.power = 1;
  state.ballTime = 9;
  state.ballCount = 20;
  state.mode = 'single';
  syncEditorUI();
}

// ── Drill picker (list dialog from editor) ───────────────────
function openDrillPicker() {
  showView('list');
}

// ── Save ─────────────────────────────────────────────────────
async function onSave() {
  const drill = state.currentDrill;
  const isNew = !drill.id || drill.id === 0;

  if (isNew || drill.uid !== 0) {
    // Custom drill → show name dialog
    $('#save-name-input').value = drill.name || '';
    openDialog('dialog-save');
  } else {
    // Official drill → save as new copy
    $('#save-name-input').value = `${drill.name} (Copy)`;
    openDialog('dialog-save');
  }
}

async function doSave(name) {
  const drill = state.currentDrill;
  const isCustom = drill.uid && drill.uid !== 0;

  const payload = {
    id: isCustom ? drill.id : 0,
    name,
    ball: state.ball,
    spin: state.spin,
    power: state.power,
    landType: state.mode === 'random' ? 2 : 0,
    ballTime: state.ballTime,
    numType: 1,
    times: state.ballCount,
    adjustSpin: 0,
    adjustPosition: 0,
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
  } catch {
    toast('Failed to save drill');
  }
}

// ── Play / Test ──────────────────────────────────────────────
async function onPlay(mode) {
  if (state.points.length === 0) {
    toast('Select at least one landing position');
    return;
  }

  const drill = buildDrillPayload();

  if (robot.connected) {
    try {
      await robot.sendBasicDrill(drill);
      toast(mode === 'test' ? 'Testing...' : 'Playing...');
    } catch (err) {
      toast('Failed to send to robot');
      console.error(err);
    }
  } else {
    toast(`${mode === 'test' ? 'Test' : 'Play'}: Connect robot first`);
  }

  // Log session
  try {
    const now = Math.floor(Date.now() / 1000);
    await api.logSession({
      drillType: state.tab,
      pid: state.currentDrill?.id || 0,
      pname: state.currentDrill?.name || 'Unnamed',
      ptype: 'pattern',
      tmode: mode,
      stime: now,
      etime: now,
      startTime: new Date().toISOString(),
    });
  } catch { /* logging is best-effort */ }
}

function buildDrillPayload() {
  return {
    ball: state.ball,
    spin: state.spin,
    power: state.power,
    landType: state.mode === 'random' ? 2 : 0,
    ballTime: state.ballTime,
    times: state.ballCount,
    adjustSpin: 0,
    adjustPosition: 0,
    points: state.points,
  };
}

// ── Bluetooth UI ─────────────────────────────────────────────
function setupBluetooth() {
  robot.onStatusChange = (status) => {
    const banner = $('#robot-banner');
    banner.classList.toggle('online', status === 'connected');
    banner.classList.toggle('offline', status !== 'connected');

    if (status === 'connected') {
      $('#robot-name').textContent = robot.deviceName || 'Robot';
      $('#robot-status').textContent = 'Connected';
    } else if (status === 'connecting') {
      $('#robot-name').textContent = 'Connecting...';
      $('#robot-status').textContent = 'Please wait';
    } else {
      $('#robot-name').textContent = 'No Robot';
      $('#robot-status').textContent = 'Tap to connect';
    }
  };
}

async function onRobotBannerClick() {
  if (robot.connected) {
    if (confirm('Disconnect from robot?')) {
      await robot.disconnect();
    }
  } else {
    try {
      await robot.connect();
      toast('Robot connected!');
    } catch (err) {
      if (err.name !== 'NotFoundError') { // user cancelled picker
        toast(err.message || 'Connection failed');
      }
    }
  }
}

// ── Dialogs ──────────────────────────────────────────────────
function openDialog(id) {
  const overlay = $(`#${id}`);
  overlay.classList.remove('hidden');

  // Pre-select current values
  if (id === 'dialog-ball') {
    overlay.querySelectorAll('.ball-type-label').forEach(l => {
      l.classList.toggle('selected', parseInt(l.dataset.ball) === state.ball);
    });
    updateBallTypeVisual(state.ball);
  } else if (id === 'dialog-spin') {
    overlay.querySelectorAll('.spin-label').forEach(l => {
      l.classList.toggle('selected', parseInt(l.dataset.spin) === state.spin);
    });
  } else if (id === 'dialog-power') {
    overlay.querySelectorAll('.power-label').forEach(l => {
      l.classList.toggle('selected', parseInt(l.dataset.power) === state.power);
    });
    updatePowerDialogVisual(state.power);
  } else if (id === 'dialog-count') {
    $('#count-input').value = state.ballCount;
  }
}

function closeDialog(id) {
  $(`#${id}`).classList.add('hidden');
}

function setupDialogs() {
  // Close on overlay click
  $$('.dialog-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog(overlay.id);
    });
  });

  // Cancel buttons
  $$('.dialog-btn.cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      closeDialog(btn.closest('.dialog-overlay').id);
    });
  });

  // ── Ball Type dialog ──
  let tempBall = state.ball;
  $('#dialog-ball').querySelectorAll('.ball-type-label').forEach(l => {
    l.addEventListener('click', () => {
      tempBall = parseInt(l.dataset.ball);
      $('#dialog-ball').querySelectorAll('.ball-type-label').forEach(x =>
        x.classList.toggle('selected', x === l));
      updateBallTypeVisual(tempBall);
    });
  });
  $('#dialog-ball .dialog-btn.confirm').addEventListener('click', () => {
    state.ball = tempBall;
    updateBallVisual();
    $('#ball-value').textContent = BALL_LABELS[state.ball];
    closeDialog('dialog-ball');
  });

  // ── Spin dialog ──
  let tempSpin = state.spin;
  $('#dialog-spin').querySelectorAll('.spin-label').forEach(l => {
    l.addEventListener('click', () => {
      tempSpin = parseInt(l.dataset.spin);
      $('#dialog-spin').querySelectorAll('.spin-label').forEach(x =>
        x.classList.toggle('selected', x === l));
    });
  });
  $('#dialog-spin .dialog-btn.confirm').addEventListener('click', () => {
    state.spin = tempSpin;
    $('#spin-value').textContent = SPIN_LABELS[state.spin];
    closeDialog('dialog-spin');
  });

  // ── Power dialog ──
  let tempPower = state.power;
  $('#dialog-power').querySelectorAll('.power-label').forEach(l => {
    l.addEventListener('click', () => {
      tempPower = parseInt(l.dataset.power);
      $('#dialog-power').querySelectorAll('.power-label').forEach(x =>
        x.classList.toggle('selected', x === l));
      updatePowerDialogVisual(tempPower);
    });
  });
  $('#dialog-power .dialog-btn.confirm').addEventListener('click', () => {
    state.power = tempPower;
    updatePowerVisual();
    $('#power-value').textContent = POWER_LABELS[state.power];
    closeDialog('dialog-power');
  });

  // ── Ball Count dialog ──
  $('#dialog-count .dialog-btn.confirm').addEventListener('click', () => {
    const val = parseInt($('#count-input').value) || 20;
    state.ballCount = Math.max(1, Math.min(999, val));
    $('#ball-count-value').textContent = `${state.ballCount} Balls ›`;
    closeDialog('dialog-count');
  });

  // ── Filter Sheet ──
  $('#filter-sheet').addEventListener('click', (e) => {
    if (e.target === $('#filter-sheet')) {
      closeFilterSheet();
      loadDrills();
      updateFilterBadge();
    }
  });
  $('#filter-close').addEventListener('click', () => {
    closeFilterSheet();
    loadDrills();
    updateFilterBadge();
  });
  $('#filter-reset').addEventListener('click', () => {
    state.filter = { ball: -1, spin: -1, patternType: -1 };
    syncFilterChips();
  });
  $$('#filter-sheet .filter-chip[data-ball]').forEach(c => {
    c.addEventListener('click', () => {
      const val = parseInt(c.dataset.ball);
      state.filter.ball = state.filter.ball === val ? -1 : val;
      syncFilterChips();
    });
  });
  $$('#filter-sheet .filter-chip[data-spin]').forEach(c => {
    c.addEventListener('click', () => {
      const val = parseInt(c.dataset.spin);
      state.filter.spin = state.filter.spin === val ? -1 : val;
      syncFilterChips();
    });
  });
  $$('#filter-sheet .filter-chip[data-pattern]').forEach(c => {
    c.addEventListener('click', () => {
      const val = parseInt(c.dataset.pattern);
      state.filter.patternType = state.filter.patternType === val ? -1 : val;
      syncFilterChips();
    });
  });
  // ── Save dialog ──
  $('#dialog-save .dialog-btn.confirm').addEventListener('click', () => {
    const name = $('#save-name-input').value.trim();
    if (!name) {
      toast('Enter a drill name');
      return;
    }
    closeDialog('dialog-save');
    doSave(name);
  });
}

// ── Filter Sheet helpers ──────────────────────────────────────
function openFilterSheet() {
  syncFilterChips();
  $('#filter-sheet').classList.remove('hidden');
}

function closeFilterSheet() {
  $('#filter-sheet').classList.add('hidden');
}

function syncFilterChips() {
  $$('#filter-sheet .filter-chip[data-ball]').forEach(c =>
    c.classList.toggle('active', parseInt(c.dataset.ball) === state.filter.ball));
  $$('#filter-sheet .filter-chip[data-spin]').forEach(c =>
    c.classList.toggle('active', parseInt(c.dataset.spin) === state.filter.spin));
  $$('#filter-sheet .filter-chip[data-pattern]').forEach(c =>
    c.classList.toggle('active', parseInt(c.dataset.pattern) === state.filter.patternType));
}

function updateFilterBadge() {
  const active = state.filter.ball !== -1 || state.filter.spin !== -1 ||
                 state.filter.patternType !== -1;
  $('#btn-filter').classList.toggle('has-filter', active);
}

// ── Visual helpers ───────────────────────────────────────────
function updateBallVisual() {
  // Main settings bar arc
  const arcs = {
    0: 'M2,16 Q14,14 26,16',   // Serve (flat)
    1: 'M2,16 Q14,4 26,16',    // Normal (medium arc)
    2: 'M2,16 Q14,-4 26,16',   // Lob (high arc)
  };
  $('#ball-arc').setAttribute('d', arcs[state.ball] || arcs[1]);
}

function updateBallTypeVisual(ball) {
  const arcs = {
    0: 'M20,100 Q100,90 180,100',
    1: 'M20,100 Q100,20 180,100',
    2: 'M20,100 Q100,-20 180,100',
  };
  const dots = { 0: { cx: 100, cy: 95 }, 1: { cx: 20, cy: 100 }, 2: { cx: 20, cy: 100 } };
  $('#ball-type-arc').setAttribute('d', arcs[ball] || arcs[1]);
  const dot = dots[ball] || dots[1];
  $('#ball-type-dot').setAttribute('cx', dot.cx);
  $('#ball-type-dot').setAttribute('cy', dot.cy);
}

function updatePowerVisual() {
  // Settings bar power indicator (0=Extreme, 1=Strong, 2=Medium, 3=Light)
  const p = state.power;
  $('#power-line1').setAttribute('opacity', p <= 0 ? '1' : '0.3');
  $('#power-line2').setAttribute('opacity', p <= 1 ? '1' : '0.3');
  $('#power-line3').setAttribute('opacity', '1');
}

function updatePowerDialogVisual(power) {
  // 0=Extreme (3 bars), 1=Strong (2 bars), 2=Medium (1 bar), 3=Light (0 bars)
  $('#power-bar1').setAttribute('opacity', power <= 0 ? '1' : '0');
  $('#power-bar2').setAttribute('opacity', power <= 1 ? '1' : '0');
  $('#power-bar3').setAttribute('opacity', power <= 2 ? '1' : '0');
}

// ── Utilities ────────────────────────────────────────────────
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return '';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 2500);
}
