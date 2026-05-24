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

function svgFor(shape, color) {
  const open = `<svg width="100%" height="100%" viewBox="0 0 100 100" aria-hidden="true" focusable="false">`;
  const close = `</svg>`;
  let inner = '';
  switch (shape) {
    case 'circle':
      inner = `<circle cx="50" cy="50" r="36" fill="${color}" stroke="${STROKE}" stroke-width="${SW}"/>`;
      break;
    case 'square':
      inner = `<rect x="16" y="16" width="68" height="68" rx="8" fill="${color}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
      break;
    case 'triangle':
      inner = `<polygon points="50,14 88,84 12,84" fill="${color}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
      break;
    case 'diamond':
      inner = `<polygon points="50,10 90,50 50,90 10,50" fill="${color}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
      break;
    case 'star':
      inner = `<polygon points="50,10 61,38 92,40 67,58 76,88 50,71 24,88 33,58 8,40 39,38" fill="${color}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
      break;
    case 'heart':
      inner = `<path d="M50,86 C20,66 10,46 10,32 A20,20 0 0 1 50,22 A20,20 0 0 1 90,32 C90,46 80,66 50,86 Z" fill="${color}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
      break;
  }
  return open + inner + close;
}

const cellKey = (c, r) => `${c},${r}`;

export function renderBoard(board, state, opts = {}) {
  const root = document.getElementById('board');
  const fallenSet = opts.fallen ? new Set(opts.fallen.map(p => cellKey(p.c, p.r))) : null;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const v = board.at(c, r);
      const tile = document.createElement('button');
      tile.className = 'tile';
      tile.dataset.c = String(c);
      tile.dataset.r = String(r);
      tile.type = 'button';
      tile.setAttribute('role', 'gridcell');
      if (v !== null && v !== undefined) {
        const def = CANDY_DEFS[v];
        tile.setAttribute(
          'aria-label',
          `${def.name} ${def.shape}, row ${r + 1}, column ${c + 1}`
        );
        tile.innerHTML = svgFor(def.shape, def.color);
      } else {
        tile.setAttribute('aria-label', `empty, row ${r + 1}, column ${c + 1}`);
      }
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
