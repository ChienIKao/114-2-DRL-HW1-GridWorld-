'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  n: 0,
  start: null,        // [row, col]
  end: null,          // [row, col]
  obstacles: [],      // [[row, col], ...]
  policy: {},         // { "row,col": action }
  values: {},         // { "row,col": number }
  optimalPath: [],    // [[row, col], ...] from value iteration
  mode: 'none',       // 'start' | 'end' | 'obstacle' | 'none'
};

const ARROW = { up: '↑', down: '↓', left: '←', right: '→' };

// ── DOM refs ───────────────────────────────────────────────────────────────
const nInput          = document.getElementById('nInput');
const btnGenGrid      = document.getElementById('btnGenGrid');
const modePanel       = document.getElementById('modePanel');
const actionPanel     = document.getElementById('actionPanel');
const statusBar       = document.getElementById('statusBar');
const gridWrapper     = document.getElementById('gridWrapper');
const gridEl          = document.getElementById('grid');
const btnSetStart     = document.getElementById('btnSetStart');
const btnSetEnd       = document.getElementById('btnSetEnd');
const btnSetObstacle  = document.getElementById('btnSetObstacle');
const btnClearMode    = document.getElementById('btnClearMode');
const obstacleCount   = document.getElementById('obstacleCount');
const btnGenPolicy       = document.getElementById('btnGeneratePolicy');
const btnEvaluate        = document.getElementById('btnEvaluate');
const btnValueIteration  = document.getElementById('btnValueIteration');
const btnReset           = document.getElementById('btnReset');
const legend             = document.getElementById('legend');

// ── Helpers ────────────────────────────────────────────────────────────────
function key(r, c) { return `${r},${c}`; }

function isObstacle(r, c) {
  return state.obstacles.some(([or, oc]) => or === r && oc === c);
}

function isStart(r, c) { return state.start && state.start[0] === r && state.start[1] === c; }
function isEnd(r, c)   { return state.end   && state.end[0]   === r && state.end[1]   === c; }

function maxObstacles() { return state.n - 2; }

function setStatus(msg, type = 'info') {
  statusBar.textContent = msg;
  statusBar.style.display = 'block';
  statusBar.style.borderLeftColor = type === 'warn' ? '#f6ad55' : type === 'ok' ? '#68d391' : '#63b3ed';
  statusBar.style.background     = type === 'warn' ? '#fffbeb' : type === 'ok' ? '#f0fff4' : '#ebf8ff';
  statusBar.style.color          = type === 'warn' ? '#c05621' : type === 'ok' ? '#276749' : '#2b6cb0';
}

function updateObstacleTag() {
  obstacleCount.textContent = `Obstacles: ${state.obstacles.length} / ${maxObstacles()}`;
}

// ── Mode Management ────────────────────────────────────────────────────────
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
  const active = document.querySelector(`.btn-mode[data-mode="${mode}"]`);
  if (active) active.classList.add('active');

  const messages = {
    start:    'Click a cell to set the Start position.',
    end:      'Click a cell to set the End (Goal) position.',
    obstacle: `Click cells to add obstacles (max ${maxObstacles()}).`,
    none:     'No mode selected. Use buttons above to interact with the grid.',
  };
  setStatus(messages[mode] || '');
}

// ── Grid Render ────────────────────────────────────────────────────────────
function renderGrid() {
  const { n } = state;
  gridEl.style.gridTemplateColumns = `repeat(${n}, 80px)`;
  gridEl.innerHTML = '';

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;

      // Cell number label (1-based, row-major)
      const numSpan = document.createElement('span');
      numSpan.className = 'cell-number';
      numSpan.textContent = r * n + c + 1;
      cell.appendChild(numSpan);

      // Arrow
      const arrowSpan = document.createElement('span');
      arrowSpan.className = 'cell-arrow';
      const act = state.policy[key(r, c)];
      if (act) arrowSpan.textContent = ARROW[act];
      cell.appendChild(arrowSpan);

      // Value
      const valSpan = document.createElement('span');
      valSpan.className = 'cell-value';
      const v = state.values[key(r, c)];
      if (v !== undefined) valSpan.textContent = v.toFixed(2);
      cell.appendChild(valSpan);

      // Type classes
      if (isObstacle(r, c))      cell.classList.add('obstacle');
      else if (isStart(r, c))    cell.classList.add('start');
      else if (isEnd(r, c))      cell.classList.add('end');
      else if (state.optimalPath.some(([pr, pc]) => pr === r && pc === c))
                                 cell.classList.add('optimal-path');

      cell.addEventListener('click', onCellClick);
      gridEl.appendChild(cell);
    }
  }

  applyValueHeat();
}

// ── Heat-map Colouring ─────────────────────────────────────────────────────
function applyValueHeat() {
  const vals = Object.values(state.values);
  if (vals.length === 0) return;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;

  // Skip cells that are on the optimal path — they keep their green class colour
  const pathSet = new Set(state.optimalPath.map(([r, c]) => key(r, c)));

  document.querySelectorAll('.cell:not(.obstacle):not(.start):not(.end):not(.optimal-path)').forEach(cell => {
    const r = +cell.dataset.r;
    const c = +cell.dataset.c;
    if (pathSet.has(key(r, c))) return;
    const v = state.values[key(r, c)];
    if (v === undefined) return;

    const t = (v - min) / range; // 0 (cold/low) → 1 (warm/high)
    // Blue (cold) → white → green (warm)
    const r8 = Math.round(180 - t * 120);
    const g8 = Math.round(200 + t * 55);
    const b8 = Math.round(230 - t * 150);
    cell.style.background = `rgb(${r8},${g8},${b8})`;
  });
}

// ── Cell Click Handler ─────────────────────────────────────────────────────
function onCellClick(e) {
  const cell = e.currentTarget;
  const r = +cell.dataset.r;
  const c = +cell.dataset.c;
  const { mode } = state;

  if (mode === 'none') return;

  if (mode === 'start') {
    if (isObstacle(r, c) || isEnd(r, c)) { setStatus('Cannot place start here.', 'warn'); return; }
    state.start = [r, c];
    setStatus(`Start set at (${r}, ${c}).`, 'ok');
    renderGrid();
    return;
  }

  if (mode === 'end') {
    if (isObstacle(r, c) || isStart(r, c)) { setStatus('Cannot place end here.', 'warn'); return; }
    state.end = [r, c];
    setStatus(`End (Goal) set at (${r}, ${c}).`, 'ok');
    renderGrid();
    return;
  }

  if (mode === 'obstacle') {
    if (isStart(r, c) || isEnd(r, c)) { setStatus('Cannot place obstacle on start/end cell.', 'warn'); return; }

    const idx = state.obstacles.findIndex(([or, oc]) => or === r && oc === c);
    if (idx !== -1) {
      // Toggle off
      state.obstacles.splice(idx, 1);
      setStatus(`Obstacle removed at (${r}, ${c}).`, 'ok');
    } else {
      if (state.obstacles.length >= maxObstacles()) {
        setStatus(`Maximum obstacles (${maxObstacles()}) already placed.`, 'warn');
        return;
      }
      state.obstacles.push([r, c]);
      setStatus(`Obstacle added at (${r}, ${c}). (${state.obstacles.length}/${maxObstacles()})`, 'ok');
    }

    updateObstacleTag();
    renderGrid();
  }
}

// ── Generate Grid ──────────────────────────────────────────────────────────
btnGenGrid.addEventListener('click', () => {
  const n = parseInt(nInput.value, 10);
  if (n < 5 || n > 9) { alert('Please enter n between 5 and 9.'); return; }

  // Reset all state
  Object.assign(state, { n, start: null, end: null, obstacles: [], policy: {}, values: {}, optimalPath: [], mode: 'none' });

  gridWrapper.style.display = 'block';
  modePanel.style.display   = 'flex';
  actionPanel.style.display = 'flex';
  legend.style.display      = 'flex';

  updateObstacleTag();
  setMode('none');
  btnEvaluate.disabled       = true;
  btnValueIteration.disabled = true;
  renderGrid();
  setStatus(`${n}×${n} grid generated. Select a mode to configure the grid.`);
});

// ── Mode buttons ───────────────────────────────────────────────────────────
[btnSetStart, btnSetEnd, btnSetObstacle, btnClearMode].forEach(btn => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

// ── Generate Policy ────────────────────────────────────────────────────────
btnGenPolicy.addEventListener('click', async () => {
  if (!state.start || !state.end) {
    setStatus('Please set both Start and End cells before generating a policy.', 'warn');
    return;
  }

  state.values = {};        // Clear old values
  state.optimalPath = [];   // Clear optimal path

  const resp = await fetch('/generate_policy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ n: state.n, obstacles: state.obstacles, goal: state.end }),
  });
  const data = await resp.json();
  state.policy = data.policy;

  btnEvaluate.disabled       = false;
  btnValueIteration.disabled = false;
  renderGrid();
  setStatus('Random policy generated. Click "Evaluate Policy" to compute V(s), or "Value Iteration" for the optimal policy.', 'ok');
});

// ── Evaluate Policy ────────────────────────────────────────────────────────
btnEvaluate.addEventListener('click', async () => {
  if (!state.end) { setStatus('Please set the End cell first.', 'warn'); return; }
  if (Object.keys(state.policy).length === 0) { setStatus('Generate a policy first.', 'warn'); return; }

  const resp = await fetch('/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      n: state.n,
      goal: state.end,
      obstacles: state.obstacles,
      policy: state.policy,
    }),
  });
  const data = await resp.json();
  state.values = data.values;

  renderGrid();
  setStatus('Policy evaluation complete. Values V(s) are displayed in each cell.', 'ok');
});

// ── Value Iteration ────────────────────────────────────────────────────────
btnValueIteration.addEventListener('click', async () => {
  if (!state.start || !state.end) {
    setStatus('Please set both Start and End cells before running value iteration.', 'warn');
    return;
  }

  btnValueIteration.disabled = true;
  btnValueIteration.textContent = 'Running…';

  const resp = await fetch('/value_iteration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      n: state.n,
      goal: state.end,
      start: state.start,
      obstacles: state.obstacles,
    }),
  });
  const data = await resp.json();

  state.policy      = data.policy;
  state.values      = data.values;
  state.optimalPath = data.path;

  btnValueIteration.disabled = false;
  btnValueIteration.textContent = 'Value Iteration';

  renderGrid();
  setStatus('Value iteration complete. Optimal policy and V*(s) displayed. Green path = optimal route to goal.', 'ok');
});

// ── Reset ──────────────────────────────────────────────────────────────────
btnReset.addEventListener('click', () => {
  Object.assign(state, { start: null, end: null, obstacles: [], policy: {}, values: {}, optimalPath: [], mode: 'none' });
  updateObstacleTag();
  setMode('none');
  btnEvaluate.disabled       = true;
  btnValueIteration.disabled = true;

  // Clear heat backgrounds
  document.querySelectorAll('.cell').forEach(c => (c.style.background = ''));
  renderGrid();
  setStatus('Grid reset. Configure start, end, and obstacles.');
});
