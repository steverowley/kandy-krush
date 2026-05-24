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
