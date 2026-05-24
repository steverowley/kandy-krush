export const CANDY_DEFS = [
  { name: 'sunshine', color: '#FFD60A', shape: 'circle' },
  { name: 'ocean',    color: '#0353A4', shape: 'square' },
  { name: 'rose',     color: '#FF006E', shape: 'triangle' },
  { name: 'pumpkin',  color: '#FB5607', shape: 'diamond' },
  { name: 'meadow',   color: '#06A77D', shape: 'star' },
  { name: 'plum',     color: '#8338EC', shape: 'heart' },
];

const STROKE = '#000';
const SW = 8;

function shapeMarkup(shape, fill) {
  switch (shape) {
    case 'circle':
      return `<circle cx="50" cy="50" r="36" fill="${fill}" stroke="${STROKE}" stroke-width="${SW}"/>`;
    case 'square':
      return `<rect x="16" y="16" width="68" height="68" rx="8" fill="${fill}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    case 'triangle':
      return `<polygon points="50,14 88,84 12,84" fill="${fill}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    case 'diamond':
      return `<polygon points="50,10 90,50 50,90 10,50" fill="${fill}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    case 'star':
      return `<polygon points="50,10 61,38 92,40 67,58 76,88 50,71 24,88 33,58 8,40 39,38" fill="${fill}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    case 'heart':
      return `<path d="M50,86 C20,66 10,46 10,32 A20,20 0 0 1 50,22 A20,20 0 0 1 90,32 C90,46 80,66 50,86 Z" fill="${fill}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
  }
  return '';
}

let gradCounter = 0;

function svgForCell(cell) {
  if (!cell) return '';
  const def = CANDY_DEFS[cell.type];
  const special = cell.special;

  let defs = '';
  let fill = def.color;
  if (special === 'rainbow') {
    const id = `rb-${gradCounter++}`;
    defs = `<defs>
      <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF006E"/>
        <stop offset="25%" stop-color="#FFD60A"/>
        <stop offset="50%" stop-color="#06A77D"/>
        <stop offset="75%" stop-color="#0353A4"/>
        <stop offset="100%" stop-color="#8338EC"/>
      </linearGradient>
    </defs>`;
    fill = `url(#${id})`;
  }

  const shape = shapeMarkup(def.shape, fill);

  let overlay = '';
  if (special === 'line-h') {
    overlay = `
      <rect x="2" y="34" width="96" height="6" fill="#fff" stroke="#000" stroke-width="2.5"/>
      <rect x="2" y="60" width="96" height="6" fill="#fff" stroke="#000" stroke-width="2.5"/>`;
  } else if (special === 'line-v') {
    overlay = `
      <rect x="34" y="2" width="6" height="96" fill="#fff" stroke="#000" stroke-width="2.5"/>
      <rect x="60" y="2" width="6" height="96" fill="#fff" stroke="#000" stroke-width="2.5"/>`;
  } else if (special === 'rainbow') {
    overlay = `
      <circle cx="32" cy="32" r="6" fill="#fff" stroke="#000" stroke-width="2"/>
      <circle cx="72" cy="68" r="4" fill="#fff" stroke="#000" stroke-width="2"/>`;
  }

  return `<svg width="100%" height="100%" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${defs}${shape}${overlay}</svg>`;
}

const cellKey = (c, r) => `${c},${r}`;

function ariaForCell(cell, c, r) {
  if (!cell) return `empty, row ${r + 1}, column ${c + 1}`;
  const def = CANDY_DEFS[cell.type];
  let prefix = '';
  if (cell.special === 'line-h') prefix = 'striped ';
  else if (cell.special === 'line-v') prefix = 'striped ';
  else if (cell.special === 'rainbow') prefix = 'rainbow ';
  return `${prefix}${def.name} ${def.shape}, row ${r + 1}, column ${c + 1}`;
}

export function renderBoard(board, state, opts = {}) {
  const root = document.getElementById('board');
  const fallenSet = opts.fallen
    ? new Set(opts.fallen.map((p) => cellKey(p.c, p.r)))
    : null;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const cell = board.cell(c, r);
      const tile = document.createElement('button');
      tile.className = 'tile';
      tile.dataset.c = String(c);
      tile.dataset.r = String(r);
      tile.type = 'button';
      tile.setAttribute('role', 'gridcell');
      tile.setAttribute('aria-label', ariaForCell(cell, c, r));
      if (cell) tile.innerHTML = svgForCell(cell);
      if (cell && cell.special) tile.classList.add('special', `special-${cell.special}`);
      if (state.selected && state.selected.c === c && state.selected.r === r) {
        tile.classList.add('selected');
      } else if (state.selected) {
        const dc = Math.abs(state.selected.c - c);
        const dr = Math.abs(state.selected.r - r);
        if ((dc === 1 && dr === 0) || (dc === 0 && dr === 1)) {
          tile.classList.add('adjacent');
        }
      }
      if (fallenSet && fallenSet.has(cellKey(c, r))) {
        tile.classList.add('falling');
      }
      frag.appendChild(tile);
    }
  }
  root.replaceChildren(frag);
}

export function tileEl(c, r) {
  return document.querySelector(`#board .tile[data-c="${c}"][data-r="${r}"]`);
}

export async function animateSwap(a, b) {
  const tA = tileEl(a.c, a.r);
  const tB = tileEl(b.c, b.r);
  if (!tA || !tB) return;
  const ra = tA.getBoundingClientRect();
  const rb = tB.getBoundingClientRect();
  const dx = rb.left - ra.left;
  const dy = rb.top - ra.top;
  tA.style.transition = tB.style.transition = 'transform 220ms ease';
  tA.style.zIndex = tB.style.zIndex = '4';
  tA.style.transform = `translate(${dx}px, ${dy}px)`;
  tB.style.transform = `translate(${-dx}px, ${-dy}px)`;
  await new Promise((res) => setTimeout(res, 235));
}

export async function animatePop(positions) {
  for (const p of positions) {
    const t = tileEl(p.c, p.r);
    if (t) t.classList.add('popping');
  }
  await new Promise((res) => setTimeout(res, 240));
}

export function setScore(n, { animate = false } = {}) {
  const el = document.getElementById('score');
  const old = Number(el.textContent.replace(/,/g, '')) || 0;
  el.textContent = n.toLocaleString();
  if (animate && n !== old) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

export function setBest(n) {
  const el = document.getElementById('best');
  if (el) el.textContent = n.toLocaleString();
}

export function setStreak(days) {
  const el = document.getElementById('streak');
  if (!el) return;
  if (!days || days < 1) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  el.textContent = days === 1 ? 'Day 1' : `Day ${days} streak`;
}

function objectiveIconSvg(level) {
  if (!level) return '';
  const o = level.objective;
  if (o.kind === 'clearType') {
    const def = CANDY_DEFS[o.type];
    return svgForCell({ type: o.type, special: null });
  }
  if (o.kind === 'matches') {
    return `<svg viewBox="0 0 100 100" aria-hidden="true" width="100%" height="100%"><circle cx="22" cy="50" r="14" fill="#FFD60A" stroke="#000" stroke-width="6"/><circle cx="50" cy="50" r="14" fill="#FFD60A" stroke="#000" stroke-width="6"/><circle cx="78" cy="50" r="14" fill="#FFD60A" stroke="#000" stroke-width="6"/></svg>`;
  }
  if (o.kind === 'specials') {
    return `<svg viewBox="0 0 100 100" aria-hidden="true" width="100%" height="100%"><circle cx="50" cy="50" r="36" fill="#FF006E" stroke="#000" stroke-width="6"/><rect x="2" y="44" width="96" height="6" fill="#fff" stroke="#000" stroke-width="2"/></svg>`;
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true" width="100%" height="100%"><polygon points="50,10 61,38 92,40 67,58 76,88 50,71 24,88 33,58 8,40 39,38" fill="#FFD60A" stroke="#000" stroke-width="6" stroke-linejoin="round"/></svg>`;
}

function objectiveFillColor(level) {
  if (!level) return '#FFD60A';
  const o = level.objective;
  if (o.kind === 'clearType') return CANDY_DEFS[o.type].color;
  if (o.kind === 'specials') return '#FF006E';
  if (o.kind === 'matches') return '#06A77D';
  return '#FFD60A';
}

function projectedStarsForRemaining(level, movesRemaining) {
  if (!level) return 0;
  const ratio = movesRemaining / level.moves;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return movesRemaining > 0 ? 1 : 0;
}

export function setLevelChip(level, mode, stars) {
  const chip = document.getElementById('level-chip');
  if (!chip) return;
  if (mode !== 'levels' || !level) {
    chip.classList.add('hidden');
    return;
  }
  chip.classList.remove('hidden');
  const earned = stars && stars > 0 ? ' ' + '★'.repeat(stars) : '';
  chip.textContent = `Level ${level.id} / 8${earned}`;
}

export function setLevelUI({ level, movesRemaining, current, target, mode }) {
  const wrap = document.getElementById('level-info');
  const movesEl = document.getElementById('moves');
  const movesLabel = document.getElementById('moves-label');
  const objEl = document.getElementById('objective-text');
  const objProgEl = document.getElementById('objective-progress');
  const objIconEl = document.getElementById('objective-icon');
  const fillEl = document.getElementById('objective-fill');
  const starsEl = document.getElementById('projected-stars');
  const nameEl = document.getElementById('level-name');
  if (!wrap) return;

  if (mode !== 'levels' || !level) {
    wrap.classList.add('hidden');
    if (movesLabel) movesLabel.classList.add('hidden');
    return;
  }

  wrap.classList.remove('hidden');
  if (movesLabel) movesLabel.classList.remove('hidden');
  if (nameEl) nameEl.textContent = `Level ${level.id} — ${level.name}`;
  if (objEl) objEl.textContent = level.hint;
  if (objProgEl) {
    objProgEl.textContent = `${Math.min(current, target).toLocaleString()} / ${target.toLocaleString()}`;
  }
  if (movesEl) {
    movesEl.textContent = String(movesRemaining);
    movesEl.classList.remove('moves-low', 'moves-critical');
    if (movesRemaining <= 2) movesEl.classList.add('moves-critical');
    else if (movesRemaining <= 5) movesEl.classList.add('moves-low');
  }
  if (objIconEl) {
    objIconEl.innerHTML = objectiveIconSvg(level);
    objIconEl.classList.remove('hidden');
  }
  if (fillEl) {
    const ratio = target > 0 ? Math.min(1, current / target) : 0;
    fillEl.style.width = `${ratio * 100}%`;
    fillEl.style.background = objectiveFillColor(level);
  }
  if (starsEl) {
    const proj = projectedStarsForRemaining(level, movesRemaining);
    starsEl.textContent = '★'.repeat(proj) + '☆'.repeat(3 - proj);
    starsEl.setAttribute('aria-label', `${proj} of 3 stars projected`);
  }
}

let moveBumpTimer;
export function bumpMoveCounter() {
  const el = document.getElementById('moves');
  if (!el) return;
  el.classList.remove('move-bump');
  void el.offsetWidth;
  el.classList.add('move-bump');
  clearTimeout(moveBumpTimer);
  moveBumpTimer = setTimeout(() => el.classList.remove('move-bump'), 360);
}

let deltaTimer;
export function flashObjectiveDelta(text) {
  const el = document.getElementById('objective-delta');
  if (!el || !text) return;
  el.textContent = text;
  el.classList.remove('hidden');
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(deltaTimer);
  deltaTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 240);
  }, 900);
}

export function showWelcome(onStart) {
  const overlay = document.getElementById('welcome-overlay');
  const panel = document.getElementById('welcome-panel');
  const btn = document.getElementById('welcome-start');
  if (!overlay || !panel || !btn) {
    if (onStart) onStart();
    return;
  }
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  btn.focus();
  const handler = () => {
    overlay.classList.add('hidden');
    panel.classList.add('hidden');
    btn.removeEventListener('click', handler);
    if (onStart) onStart();
  };
  btn.addEventListener('click', handler);
}

let introTimer;
export function showLevelIntro(level, totalLevels = 8) {
  const card = document.getElementById('level-intro');
  if (!card || !level) return;
  document.getElementById('li-tag').textContent = `Level ${level.id} of ${totalLevels}`;
  document.getElementById('li-name').textContent = level.name;
  document.getElementById('li-hint').textContent = level.hint;
  document.getElementById('li-moves').textContent =
    level.moves === 1 ? '1 move' : `${level.moves} moves`;
  card.classList.remove('hidden');
  card.classList.remove('show');
  void card.offsetWidth;
  card.classList.add('show');
  clearTimeout(introTimer);
  introTimer = setTimeout(() => {
    card.classList.remove('show');
    setTimeout(() => card.classList.add('hidden'), 320);
  }, 2400);
}

function starString(stars) {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars);
}

export function showLevelComplete({ level, stars, score, onNext, onReplay, isLast }) {
  const overlay = document.getElementById('level-overlay');
  const panel = document.getElementById('level-complete');
  const failPanel = document.getElementById('level-fail');
  const title = document.getElementById('lc-title');
  const starsEl = document.getElementById('lc-stars');
  const scoreEl = document.getElementById('lc-score');
  const nextBtn = document.getElementById('lc-next');
  const replayBtn = document.getElementById('lc-replay');
  if (!overlay || !panel) return;
  if (failPanel) failPanel.classList.add('hidden');

  title.textContent = isLast ? `${level.name} — All done!` : `Level ${level.id} complete!`;
  starsEl.textContent = starString(stars);
  starsEl.setAttribute('aria-label', `${stars} of 3 stars`);
  scoreEl.textContent = `Score: ${score.toLocaleString()}`;
  nextBtn.textContent = isLast ? 'Play again' : 'Next level';

  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');

  nextBtn.onclick = () => {
    hideLevelOverlay();
    onNext();
  };
  replayBtn.onclick = () => {
    hideLevelOverlay();
    onReplay();
  };
  nextBtn.focus();
}

export function showLevelFail({ level, score, onReplay, onSkip, canSkip }) {
  const overlay = document.getElementById('level-overlay');
  const panel = document.getElementById('level-fail');
  const completePanel = document.getElementById('level-complete');
  const title = document.getElementById('lf-title');
  const scoreEl = document.getElementById('lf-score');
  const replayBtn = document.getElementById('lf-replay');
  const skipBtn = document.getElementById('lf-skip');
  if (!overlay || !panel) return;
  if (completePanel) completePanel.classList.add('hidden');

  title.textContent = 'So close!';
  scoreEl.textContent = `You scored ${score.toLocaleString()} — try again?`;

  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');

  replayBtn.onclick = () => {
    hideLevelOverlay();
    onReplay();
  };
  if (canSkip) {
    skipBtn.classList.remove('hidden');
    skipBtn.onclick = () => {
      hideLevelOverlay();
      onSkip();
    };
  } else {
    skipBtn.classList.add('hidden');
  }
  replayBtn.focus();
}

export function hideLevelOverlay() {
  const overlay = document.getElementById('level-overlay');
  const complete = document.getElementById('level-complete');
  const fail = document.getElementById('level-fail');
  if (overlay) overlay.classList.add('hidden');
  if (complete) complete.classList.add('hidden');
  if (fail) fail.classList.add('hidden');
}

let msgTimer;
export function flashMessage(text, holdMs = 1200) {
  const el = document.getElementById('message');
  el.textContent = text || '';
  clearTimeout(msgTimer);
  if (text) {
    msgTimer = setTimeout(() => {
      el.textContent = '';
    }, holdMs);
  }
}

export function applyTheme({ contrast, size }) {
  const body = document.body;
  body.classList.toggle('theme-hc', !!contrast);
  body.classList.remove('size-small', 'size-medium', 'size-large');
  body.classList.add(`size-${size || 'medium'}`);
}

export function showHintGlow(a, b) {
  clearHintGlow();
  const tA = tileEl(a.c, a.r);
  const tB = tileEl(b.c, b.r);
  if (tA) tA.classList.add('hint');
  if (tB) tB.classList.add('hint');
}

export function clearHintGlow() {
  for (const t of document.querySelectorAll('#board .tile.hint')) {
    t.classList.remove('hint');
  }
}

let achTimer;
export function showAchievement(text) {
  const el = document.getElementById('achievement');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(achTimer);
  achTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 400);
  }, 1800);
}
