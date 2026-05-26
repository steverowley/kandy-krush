import { LEVELS as ALL_LEVELS } from '../game/levels.js';
import {
  isCanvasMode,
  initCanvasRenderer,
  renderBoardCanvas,
  animateSwapCanvas,
  animatePopCanvas,
} from './canvas-renderer.js';

// Init Pixi as soon as the board element exists (after the DOM grid is
// laid out so cell sizes are stable). The flag is checked inside every
// canvas-renderer entry point, so calling these in DOM mode is a no-op.
let canvasReadyPromise = null;
function ensureCanvasReady(cols, rows) {
  if (!isCanvasMode()) return null;
  if (canvasReadyPromise) return canvasReadyPromise;
  const boardEl = document.getElementById('board');
  if (!boardEl) return null;
  canvasReadyPromise = initCanvasRenderer({ boardEl, cols, rows }).catch((err) => {
    canvasReadyPromise = null;
    // eslint-disable-next-line no-console
    console.error('[canvas-renderer] init failed, falling back to DOM:', err);
  });
  return canvasReadyPromise;
}

export const CANDY_DEFS = [
  { name: 'sunshine', color: '#FFD60A', shape: 'circle' },
  { name: 'ocean',    color: '#0353A4', shape: 'square' },
  { name: 'rose',     color: '#FF006E', shape: 'triangle' },
  { name: 'pumpkin',  color: '#FB5607', shape: 'hexagon' },
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
    case 'hexagon':
      // Point-top hexagon, taller than wide. Reads as instantly different
      // from the pink triangle even at small sizes.
      return `<polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill="${fill}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
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

// Escape any string before interpolating it into an HTML template.
// Game catalog data (class names, relic / mutator / upgrade descriptions)
// is currently safe-by-source but a corrupted save or future user-supplied
// content shouldn't be able to inject markup. Cheap and consistent.
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Pick black or white text based on the perceived luminance of a hex
// color so chips render with enough contrast (WCAG AA at typical sizes).
function contrastTextOn(hex) {
  const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return '#000';
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 160 ? '#000' : '#fff';
}

function ariaForCell(cell, c, r) {
  if (!cell) return `empty, row ${r + 1}, column ${c + 1}`;
  const def = CANDY_DEFS[cell.type];
  let prefix = '';
  if (cell.special === 'line-h') prefix = 'striped ';
  else if (cell.special === 'line-v') prefix = 'striped ';
  else if (cell.special === 'rainbow') prefix = 'rainbow ';
  return `${prefix}${def.name} ${def.shape}, row ${r + 1}, column ${c + 1}`;
}

// Short human-readable description shown on tile hover (desktop) and
// long-press (mobile). Returns null for plain candies so we don't
// spam tooltips on tiles that don't do anything special.
function tooltipForCell(cell, jellyLvl, lockLvl, isGrumblock) {
  const parts = [];
  if (cell && cell.ingredient) {
    parts.push('🍒 Cherry — drop it off the bottom row to score it. Some levels need a count of these.');
  } else if (cell && cell.crazy === 'tnt') {
    parts.push('💣 TNT — pop with a match to blast a 3×3 area. Bomber synergy and Bigger Bomb make it 5×5 → 7×7 → 9×9.');
  } else if (cell && cell.crazy === 'void') {
    parts.push('🌀 Void — pop with a match to swallow 8 random tiles across the board.');
  } else if (cell && cell.crazy === 'bolt') {
    parts.push('⚡ Bolt — pop with a match to clear the row AND column it sits on.');
  } else if (cell && cell.crazy === 'wormhole') {
    parts.push('🕳 Wormhole — pop to swap two random tiles, then clear itself. Sets up fresh matches.');
  } else if (cell && cell.crazy === 'prism') {
    parts.push('🌈 Prism — pop with a match to clear ALL tiles of one random color. Boardwipe potential.');
  } else if (cell && cell.special === 'rainbow') {
    parts.push('🌟 Rainbow special — swap with any candy to clear EVERY tile of that color.');
  } else if (cell && cell.special === 'line-h') {
    parts.push('🍫 Striped (horizontal) — clears its entire row when matched.');
  } else if (cell && cell.special === 'line-v') {
    parts.push('🍫 Striped (vertical) — clears its entire column when matched.');
  }
  if (isGrumblock) {
    parts.push('🪨 Grumblock — wandering enemy. Locks one tile. Match around it to break it.');
  } else if (lockLvl === 2) {
    parts.push('🔒 Locked (×2) — needs TWO matches adjacent to break free.');
  } else if (lockLvl === 1) {
    parts.push('🔒 Locked — match an adjacent tile to break it.');
  }
  if (jellyLvl === 2) {
    parts.push('🟦 Double jelly — needs TWO matches over this cell to clear.');
  } else if (jellyLvl === 1) {
    parts.push('🟦 Jelly — match over this cell to clear it.');
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

// 🚀 Diff-render cache (Phase 17m / B7).
//
// Old behavior: every renderBoard call rebuilt all 36 buttons + SVGs
// from scratch via `root.replaceChildren(frag)`. A chain-10 cascade
// triggered ~7 full rebuilds, throwing away 252 tile nodes + ~280
// SVG nodes per second. The perf review flagged this as the largest
// avoidable runtime cost.
//
// New: per-cell signature cache. We compute a compact signature for
// every cell (encodes type, special, crazy, jelly, lock, selected,
// falling, intro) and only re-paint cells whose signature changed.
// `intro: true` and dimension changes still force a full rebuild
// (animations want fresh nodes).
const _diffCache = new WeakMap(); // boardRoot -> { tiles: [r][c], sigs: [r][c], rows, cols }

function _cellSignature(cell, c, r, state, fallenSet, introDrop) {
  if (introDrop) return '__intro__'; // forces a rebuild every intro
  const sel = state.selected;
  const isSelected = !!(sel && sel.c === c && sel.r === r);
  let isAdjacent = false;
  if (sel && !isSelected) {
    const dc = Math.abs(sel.c - c);
    const dr = Math.abs(sel.r - r);
    isAdjacent = (dc === 1 && dr === 0) || (dc === 0 && dr === 1);
  }
  const falling = fallenSet && fallenSet.has(cellKey(c, r)) ? 1 : 0;
  const k = cellKey(c, r);
  const jelly = state.jellyMap ? (state.jellyMap.get(k) || 0) : 0;
  const lock = state.lockMap ? (state.lockMap.get(k) || 0) : 0;
  const grum = state.grumblockSet && state.grumblockSet.has(k) ? 1 : 0;
  if (!cell) return `e|${isSelected ? 1 : 0}|${isAdjacent ? 1 : 0}|${falling}|${jelly}|${lock}|${grum}`;
  return [
    cell.type ?? '',
    cell.ingredient ? 'i' : '',
    cell.crazy || '',
    cell.special || '',
    isSelected ? 's' : '',
    isAdjacent ? 'a' : '',
    falling ? 'f' : '',
    jelly,
    lock,
    grum ? 'g' : '',
  ].join('|');
}

function _paintTile(tile, cell, c, r, state, fallenSet, introDrop) {
  // Reset to a clean baseline so we don't carry over stale classes /
  // attributes from a previous paint.
  tile.className = 'tile';
  // 🧹 Clear any inline styles a previous animation may have left on
  // this tile. The diff renderer recycles DOM nodes across renders,
  // so a stale `transform`, `zIndex`, or `transition` from animateSwap
  // (or any future tween) would persist and visually displace the
  // tile. Animation code SHOULD clean up its own inline styles when
  // it finishes — this is the belt-and-suspenders fallback.
  tile.style.transform = '';
  tile.style.transition = '';
  tile.style.zIndex = '';
  tile.dataset.c = String(c);
  tile.dataset.r = String(r);
  tile.type = 'button';
  tile.setAttribute('role', 'gridcell');
  tile.setAttribute('aria-label', ariaForCell(cell, c, r));
  tile.removeAttribute('title');
  tile.innerHTML = '';
  if (introDrop) {
    tile.classList.add('intro-drop');
    tile.style.setProperty('--intro-delay', `${c * 40 + r * 20}ms`);
  } else {
    tile.style.removeProperty('--intro-delay');
  }
  if (cell) {
    if (cell.ingredient) {
      tile.classList.add('ingredient');
      tile.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <path d="M40 38 Q55 16 76 22" fill="none" stroke="#15803D" stroke-width="6" stroke-linecap="round"/>
        <path d="M44 38 Q62 12 78 20" fill="none" stroke="#16A34A" stroke-width="5" stroke-linecap="round"/>
        <circle cx="35" cy="68" r="22" fill="#DC2626" stroke="#000" stroke-width="5"/>
        <circle cx="68" cy="65" r="20" fill="#B91C1C" stroke="#000" stroke-width="5"/>
        <ellipse cx="28" cy="60" rx="6" ry="4" fill="#fff" opacity="0.5"/>
      </svg>`;
    } else if (cell.crazy === 'tnt') {
      tile.classList.add('crazy', 'crazy-tnt');
      tile.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle cx="52" cy="60" r="32" fill="#1f1a2e" stroke="#000" stroke-width="6"/>
        <path d="M50 28 Q60 16 74 14" fill="none" stroke="#6b7280" stroke-width="5" stroke-linecap="round"/>
        <circle cx="76" cy="14" r="6" fill="#FFD60A" stroke="#000" stroke-width="3"/>
        <circle cx="76" cy="14" r="3" fill="#fff"/>
        <text x="52" y="68" text-anchor="middle" font-size="26" font-weight="bold" fill="#fff" stroke="#000" stroke-width="2">TNT</text>
      </svg>`;
    } else if (cell.crazy === 'void') {
      tile.classList.add('crazy', 'crazy-void');
      tile.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="void-${c}-${r}"><stop offset="0%" stop-color="#000"/><stop offset="60%" stop-color="#3b0066"/><stop offset="100%" stop-color="#8338EC"/></radialGradient>
        </defs>
        <circle cx="50" cy="50" r="40" fill="url(#void-${c}-${r})" stroke="#000" stroke-width="5"/>
        <circle cx="50" cy="50" r="10" fill="#000"/>
        <circle cx="50" cy="50" r="32" fill="none" stroke="#FF006E" stroke-width="2" opacity="0.6"/>
        <circle cx="50" cy="50" r="22" fill="none" stroke="#FFD60A" stroke-width="2" opacity="0.4"/>
      </svg>`;
    } else if (cell.crazy === 'bolt') {
      tile.classList.add('crazy', 'crazy-bolt');
      tile.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle cx="50" cy="50" r="42" fill="#1e1a30" stroke="#000" stroke-width="5"/>
        <polygon points="55,12 28,55 48,55 40,88 72,42 52,42 60,12" fill="#FFD60A" stroke="#000" stroke-width="4" stroke-linejoin="round"/>
      </svg>`;
    } else if (cell.crazy === 'wormhole') {
      tile.classList.add('crazy', 'crazy-wormhole');
      tile.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="worm-${c}-${r}"><stop offset="0%" stop-color="#000"/><stop offset="60%" stop-color="#1e1a30"/><stop offset="100%" stop-color="#0353A4"/></radialGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="url(#worm-${c}-${r})" stroke="#000" stroke-width="5"/>
        <circle cx="50" cy="50" r="30" fill="none" stroke="#06A77D" stroke-width="3" stroke-dasharray="6 4"/>
        <circle cx="50" cy="50" r="18" fill="none" stroke="#FFD60A" stroke-width="2" stroke-dasharray="3 3"/>
        <circle cx="50" cy="50" r="6" fill="#000"/>
      </svg>`;
    } else if (cell.crazy === 'prism') {
      tile.classList.add('crazy', 'crazy-prism');
      tile.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="prism-${c}-${r}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#FFD60A"/>
            <stop offset="33%" stop-color="#FB5607"/>
            <stop offset="66%" stop-color="#8338EC"/>
            <stop offset="100%" stop-color="#06A77D"/>
          </linearGradient>
        </defs>
        <polygon points="50,8 88,50 50,92 12,50" fill="url(#prism-${c}-${r})" stroke="#000" stroke-width="5" stroke-linejoin="round"/>
        <polygon points="50,18 78,50 50,82 22,50" fill="#fff" opacity="0.35"/>
      </svg>`;
    } else {
      tile.innerHTML = svgForCell(cell);
    }
  }
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
  let jellyLvl = 0;
  if (state.jellyMap) {
    const j = state.jellyMap.get(cellKey(c, r));
    if (j === 2) { jellyLvl = 2; tile.classList.add('jelly', 'jelly-2'); }
    else if (j === 1) { jellyLvl = 1; tile.classList.add('jelly', 'jelly-1'); }
  }
  let lockLvl = 0;
  let isGrumblock = false;
  if (state.lockMap) {
    const lk = state.lockMap.get(cellKey(c, r));
    if (lk && lk > 0) {
      lockLvl = lk;
      isGrumblock = state.grumblockSet && state.grumblockSet.has(cellKey(c, r));
      tile.classList.add('locked');
      if (lk === 2) tile.classList.add('locked-2');
      if (isGrumblock) tile.classList.add('grumblock');
      const badge = document.createElement('span');
      badge.className = isGrumblock ? 'grumblock-badge' : 'lock-badge';
      badge.setAttribute('aria-hidden', 'true');
      if (isGrumblock) {
        badge.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 17 L7 9 L13 7 L19 11 L21 17 L17 21 L7 21 Z" fill="#555" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
          <circle cx="10" cy="13" r="1.2" fill="#fff"/>
          <circle cx="15" cy="14" r="1.2" fill="#fff"/>
          <circle cx="10.4" cy="13" r="0.5" fill="#000"/>
          <circle cx="15.4" cy="14" r="0.5" fill="#000"/>
        </svg>`;
      } else {
        badge.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" fill="#FFD60A" stroke="#000" stroke-width="2"/>
          <path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="15" r="1.5" fill="#000"/>
        </svg>${lk === 2 ? '<span class="lock-hits">2</span>' : ''}`;
      }
      tile.appendChild(badge);
    }
  }
  const tipText = tooltipForCell(cell, jellyLvl, lockLvl, isGrumblock);
  if (tipText) tile.title = tipText;
}

export function renderBoard(board, state, opts = {}) {
  // Side-car: in canvas mode we still build the DOM grid (transparent
  // hit targets) AND drive the Pixi pipeline. The CSS hides the SVG
  // candies so only the canvas paint shows.
  if (isCanvasMode()) {
    const ready = ensureCanvasReady(board.cols, board.rows);
    if (ready) ready.then(() => renderBoardCanvas(board, { intro: !!opts.intro }));
  }
  const root = document.getElementById('board');
  const fallenSet = opts.fallen
    ? new Set(opts.fallen.map((p) => cellKey(p.c, p.r)))
    : null;
  const introDrop = !!opts.intro;

  // 🚀 Diff-render path. On cache hit, only mutate cells whose signature
  // changed since the last render. Intro drops + dimension changes
  // bypass the cache (fresh nodes required for the drop animation).
  let cache = _diffCache.get(root);
  const fresh = !cache || cache.rows !== board.rows || cache.cols !== board.cols || introDrop;
  if (fresh) {
    cache = {
      tiles: Array.from({ length: board.rows }, () => new Array(board.cols).fill(null)),
      sigs: Array.from({ length: board.rows }, () => new Array(board.cols).fill(null)),
      rows: board.rows,
      cols: board.cols,
    };
    _diffCache.set(root, cache);
    root.replaceChildren();
  }
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const cell = board.cell(c, r);
      const sig = _cellSignature(cell, c, r, state, fallenSet, introDrop);
      let tile = cache.tiles[r][c];
      if (!tile) {
        tile = document.createElement('button');
        cache.tiles[r][c] = tile;
        root.appendChild(tile);
      } else if (cache.sigs[r][c] === sig) {
        continue; // 🚀 no-op — unchanged cell
      }
      _paintTile(tile, cell, c, r, state, fallenSet, introDrop);
      cache.sigs[r][c] = sig;
    }
  }
  ensureTileLongPress(root);
}


// One-time delegated long-press listener on the board root for mobile
// tooltips. Reuses the title attribute set in renderBoard so there's
// only one source of truth.
let longPressInstalled = false;
let longPressTimer = null;
let longPressTooltip = null;
function ensureTileLongPress(boardRoot) {
  if (longPressInstalled) return;
  longPressInstalled = true;
  function makeTooltipEl() {
    if (longPressTooltip) return longPressTooltip;
    longPressTooltip = document.createElement('div');
    longPressTooltip.id = 'tile-tooltip';
    longPressTooltip.className = 'tile-tooltip hidden';
    longPressTooltip.setAttribute('role', 'tooltip');
    longPressTooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(longPressTooltip);
    return longPressTooltip;
  }
  function hide() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    if (longPressTooltip) {
      longPressTooltip.classList.add('hidden');
      longPressTooltip.setAttribute('aria-hidden', 'true');
    }
  }
  function showFor(tile) {
    const text = tile.getAttribute('title');
    if (!text) return;
    const el = makeTooltipEl();
    el.textContent = text;
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
    const rect = tile.getBoundingClientRect();
    // Default: above the tile. Flip below if too close to top.
    const tipRect = el.getBoundingClientRect();
    let top = rect.top - tipRect.height - 8;
    if (top < 8) top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }
  boardRoot.addEventListener('touchstart', (e) => {
    const tile = e.target && e.target.closest && e.target.closest('.tile');
    if (!tile) return;
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      showFor(tile);
    }, 500);
  }, { passive: true });
  boardRoot.addEventListener('touchmove', hide, { passive: true });
  boardRoot.addEventListener('touchend', hide);
  boardRoot.addEventListener('touchcancel', hide);
  // Dismiss the popup on any tap outside the board too.
  document.addEventListener('touchstart', (e) => {
    if (!longPressTooltip || longPressTooltip.classList.contains('hidden')) return;
    if (e.target && !e.target.closest('.tile')) hide();
  }, { passive: true });
}

// Briefly block clicks inside a panel after it opens so the player can't
// accidentally pick the wrong relic / upgrade / option by tapping
// through from a previous animation. After `ms` the panel re-enables.
function blockClicksFor(panelEl, ms = 600) {
  if (!panelEl) return;
  panelEl.style.pointerEvents = 'none';
  panelEl.classList.add('picker-locked');
  setTimeout(() => {
    panelEl.style.pointerEvents = '';
    panelEl.classList.remove('picker-locked');
  }, ms);
}

// Modal focus restoration. Capture activeElement when the modal opens
// and restore it on close so keyboard / screen-reader users land back
// on the trigger element they invoked the modal from. Keeps a stack so
// nested modals work.
const focusStack = [];
function captureFocus() {
  const el = document.activeElement;
  focusStack.push(el && el !== document.body ? el : null);
}
function restoreFocus() {
  const el = focusStack.pop();
  if (el && typeof el.focus === 'function') {
    try { el.focus(); } catch {}
  }
}

// Replace a previously-attached listener of a given `key` on a persistent
// DOM element. Without this, calling show*() multiple times without
// closing in between stacks duplicate listeners on the close button.
const listenerRegistry = new WeakMap();
function replaceListener(el, eventType, handler, key) {
  if (!el || !key) return;
  let map = listenerRegistry.get(el);
  if (!map) { map = new Map(); listenerRegistry.set(el, map); }
  const existing = map.get(key);
  if (existing) el.removeEventListener(eventType, existing);
  el.addEventListener(eventType, handler);
  map.set(key, handler);
}

export function tileEl(c, r) {
  return document.querySelector(`#board .tile[data-c="${c}"][data-r="${r}"]`);
}

export async function animateSwap(a, b) {
  // Canvas mode: drive the Pixi swap tween. The DOM tiles are invisible
  // hit targets in this mode, so we still run the DOM transform tween
  // BUT skip it visually (the canvas does the real work) — this keeps
  // the 220ms timing as a single source of truth.
  if (isCanvasMode()) {
    await animateSwapCanvas(a, b);
    return;
  }
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
  // 🧹 Clear the inline styles we set above. Before the diff-render
  // landed (#269) the board rebuilt fresh tiles on every render, so
  // stale inline styles got tossed out automatically. The diff
  // renderer recycles the SAME DOM nodes across renders, so without
  // this cleanup the transform persists and visually displaces tiles
  // on subsequent paints ("tiles shooting off screen, disappearing,
  // moving around the map").
  tA.style.transform = tB.style.transform = '';
  tA.style.transition = tB.style.transition = '';
  tA.style.zIndex = tB.style.zIndex = '';
}

export async function animatePop(positions) {
  if (isCanvasMode()) {
    await animatePopCanvas(positions);
    return;
  }
  for (const p of positions) {
    const t = tileEl(p.c, p.r);
    if (t) t.classList.add('popping');
  }
  await new Promise((res) => setTimeout(res, 240));
}

let scoreRollFrame = null;
export function setScore(n, { animate = false } = {}) {
  const el = document.getElementById('score');
  if (!el) return;
  // Honor the infinity-combo override; clearScoreOverride() releases it.
  if (el.dataset.override === '1') return;
  const old = Number(el.textContent.replace(/,/g, '')) || 0;
  if (animate && n > old) {
    if (scoreRollFrame) cancelAnimationFrame(scoreRollFrame);
    const start = old;
    const end = n;
    const t0 = performance.now();
    // Roll up to 1100ms for big jumps so cascade payouts feel weighty.
    const duration = Math.min(1100, 240 + (end - start) * 0.8);
    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const display = Math.floor(start + (end - start) * eased);
      el.textContent = display.toLocaleString();
      if (p < 1) scoreRollFrame = requestAnimationFrame(step);
      else {
        el.textContent = end.toLocaleString();
        scoreRollFrame = null;
      }
    };
    scoreRollFrame = requestAnimationFrame(step);
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  } else {
    el.textContent = n.toLocaleString();
    if (animate && n !== old) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }
}

export function setBest(n) {
  const el = document.getElementById('best');
  if (el) el.textContent = n.toLocaleString();
}

// Paint an arbitrary string as the score and lock further setScore calls
// from overwriting it until clearScoreOverride() is called. Used for the
// infinity-combo auto-win label (∞, ∞+1, ∞+2, …).
export function setScoreOverride(label) {
  const el = document.getElementById('score');
  if (!el) return;
  el.dataset.override = '1';
  el.textContent = label;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

export function clearScoreOverride() {
  const el = document.getElementById('score');
  if (el) delete el.dataset.override;
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
  if (o.kind === 'clearJelly') {
    return `<svg viewBox="0 0 100 100" aria-hidden="true" width="100%" height="100%"><rect x="10" y="10" width="80" height="80" rx="14" fill="#C4B5FD" stroke="#000" stroke-width="6"/><path d="M22 70 Q30 56 38 70 T54 70 T70 70" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.7"/></svg>`;
  }
  if (o.kind === 'dropIngredients') {
    return `<svg viewBox="0 0 100 100" aria-hidden="true" width="100%" height="100%">
      <path d="M42 38 Q56 18 78 22" fill="none" stroke="#15803D" stroke-width="6" stroke-linecap="round"/>
      <circle cx="36" cy="68" r="22" fill="#DC2626" stroke="#000" stroke-width="5"/>
      <circle cx="68" cy="66" r="20" fill="#B91C1C" stroke="#000" stroke-width="5"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true" width="100%" height="100%"><polygon points="50,10 61,38 92,40 67,58 76,88 50,71 24,88 33,58 8,40 39,38" fill="#FFD60A" stroke="#000" stroke-width="6" stroke-linejoin="round"/></svg>`;
}

function objectiveFillColor(level) {
  if (!level) return '#FFD60A';
  const o = level.objective;
  if (o.kind === 'clearType') return CANDY_DEFS[o.type].color;
  if (o.kind === 'specials') return '#FF006E';
  if (o.kind === 'matches') return '#06A77D';
  if (o.kind === 'clearJelly') return '#8B5CF6';
  if (o.kind === 'dropIngredients') return '#DC2626';
  return '#FFD60A';
}

function projectedStarsForRemaining(level, movesRemaining) {
  if (!level) return 0;
  const ratio = movesRemaining / level.moves;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return movesRemaining > 0 ? 1 : 0;
}

export function setLevelChip(level, mode, stars, opts = {}) {
  const chip = document.getElementById('level-chip');
  if (!chip) return;
  if (mode === 'roguelike') {
    chip.classList.remove('hidden');
    const slot = opts.slot || 1;
    const total = opts.total || 30;
    const gems = opts.gems || 0;
    const boss = opts.isBoss ? ' BOSS' : '';
    const lives = Math.max(0, Math.min(9, opts.lives || 0));
    const maxLives = Math.max(lives, Math.min(9, opts.maxLives || lives));
    const hearts = '♥'.repeat(lives) + '♡'.repeat(Math.max(0, maxLives - lives));
    chip.textContent = `Slot ${slot}/${total}${boss} · ${hearts} · ${gems}💎`;
    return;
  }
  if (mode !== 'levels' || !level) {
    chip.classList.add('hidden');
    return;
  }
  chip.classList.remove('hidden');
  const earned = stars && stars > 0 ? ' ' + '★'.repeat(stars) : '';
  chip.textContent = `Level ${level.id} / ${ALL_LEVELS.length}${earned}`;
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

  if ((mode !== 'levels' && mode !== 'roguelike') || !level) {
    wrap.classList.add('hidden');
    if (movesLabel) movesLabel.classList.add('hidden');
    return;
  }

  wrap.classList.remove('hidden');
  if (movesLabel) movesLabel.classList.remove('hidden');
  if (nameEl) {
    if (mode === 'roguelike') {
      const slot = level.runSlot || level.id;
      const bossTag = level.isBoss ? ' · BOSS' : '';
      nameEl.textContent = `Slot ${slot} of 100${bossTag} — ${level.name}`;
    } else {
      nameEl.textContent = `Level ${level.id} — ${level.name}`;
    }
  }
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

export function setPowerupCounts({ hammer, shuffle, colorBomb, plusMoves }) {
  const map = {
    hammer: { count: hammer, btn: 'pu-hammer', countEl: 'pu-hammer-count' },
    shuffle: { count: shuffle, btn: 'pu-shuffle', countEl: 'pu-shuffle-count' },
    colorBomb: { count: colorBomb, btn: 'pu-colorbomb', countEl: 'pu-colorbomb-count' },
    plusMoves: { count: plusMoves, btn: 'pu-plusmoves', countEl: 'pu-plusmoves-count' },
  };
  for (const cfg of Object.values(map)) {
    const c = document.getElementById(cfg.countEl);
    const b = document.getElementById(cfg.btn);
    if (c && cfg.count != null) c.textContent = String(cfg.count);
    if (b && cfg.count != null) b.disabled = cfg.count <= 0;
  }
}

const ARM_CONFIG = {
  hammer:    { btn: 'pu-hammer',    hint: 'Tap a candy to smash',           boardClass: 'hammer-armed' },
  colorBomb: { btn: 'pu-colorbomb', hint: 'Tap a candy to clear its color', boardClass: 'colorbomb-armed' },
};

export function setArmedTool(tool) {
  const hint = document.getElementById('pu-hint');
  const board = document.getElementById('board');
  for (const cfg of Object.values(ARM_CONFIG)) {
    const b = document.getElementById(cfg.btn);
    if (b) b.classList.remove('armed');
    if (board) board.classList.remove(cfg.boardClass);
  }
  if (!tool || !ARM_CONFIG[tool]) {
    if (hint) hint.classList.add('hidden');
    return;
  }
  const cfg = ARM_CONFIG[tool];
  const b = document.getElementById(cfg.btn);
  if (b) b.classList.add('armed');
  if (board) board.classList.add(cfg.boardClass);
  if (hint) {
    hint.textContent = cfg.hint;
    hint.classList.remove('hidden');
  }
}

export function setHammerArmed(armed) {
  setArmedTool(armed ? 'hammer' : null);
}

const CASCADE_LABELS = {
  2: 'CASCADE!',
  3: 'TRIPLE!',
  4: 'QUADRUPLE!',
  5: 'INCREDIBLE!',
};

let cascadeTimer;
export function showCascadeBanner(level) {
  const wrap = document.getElementById('cascade-banner');
  const text = document.getElementById('cascade-text');
  if (!wrap || !text) return;
  text.textContent = CASCADE_LABELS[level] || `${level}x WOW!`;
  wrap.classList.remove('hidden');
  text.classList.remove('cascade-show');
  void text.offsetWidth;
  text.classList.add('cascade-show');
  clearTimeout(cascadeTimer);
  cascadeTimer = setTimeout(() => {
    wrap.classList.add('hidden');
  }, 1000);
}

export function popNewSpecial(c, r) {
  const tile = document.querySelector(
    `#board .tile[data-c="${c}"][data-r="${r}"]`
  );
  if (!tile) return;
  tile.classList.remove('spawn-special');
  void tile.offsetWidth;
  tile.classList.add('spawn-special');
  setTimeout(() => tile.classList.remove('spawn-special'), 720);
}

// 🏅 Class-mastery modal. `classes` is the list of all 11 classes;
// `classStats` is the per-class {runs, completes, bestSlot} record from
// state.roguelike.classStats. Tiers derived from bestSlot + completes:
//   🥉 Bronze — bestSlot >= 10 with this class
//   🥈 Silver — bestSlot >= 30
//   🥇 Gold   — at least 1 run completed (slot 100)
export function showClassMastery({ classes, classStats, onClose }) {
  const overlay = document.getElementById('class-mastery-overlay');
  const panel = document.getElementById('class-mastery-panel');
  const list = document.getElementById('class-mastery-list');
  const close = document.getElementById('class-mastery-close');
  if (!overlay || !panel || !list || !close) return;
  captureFocus();
  list.innerHTML = '';
  for (const cls of classes) {
    const stats = (classStats && classStats[cls.id]) || { runs: 0, completes: 0, bestSlot: 0 };
    const gold = stats.completes >= 1;
    const silver = stats.bestSlot >= 30 || gold;
    const bronze = stats.bestSlot >= 10 || silver;
    const tiers = [
      bronze ? '🥉' : '·',
      silver ? '🥈' : '·',
      gold ? '🥇' : '·',
    ].join(' ');
    const row = document.createElement('div');
    row.className = 'border-2 border-black rounded-xl p-3 bg-amber-50 flex items-center gap-3';
    row.innerHTML = `
      <span class="text-3xl" aria-hidden="true">${escapeHtml(cls.icon)}</span>
      <div class="flex-1 min-w-0">
        <div class="font-bold text-gray-900">${escapeHtml(cls.name)}</div>
        <div class="text-sm text-gray-700">${stats.runs} runs · ${stats.completes} cleared · best slot ${stats.bestSlot}</div>
      </div>
      <div class="text-2xl tabular-nums" aria-label="Mastery tiers">${tiers}</div>
    `;
    list.appendChild(row);
  }
  const handleClose = () => {
    overlay.classList.add('hidden');
    panel.classList.add('hidden');
    restoreFocus();
    if (onClose) onClose();
  };
  replaceListener(close, 'click', handleClose, 'class-mastery-close');
  replaceListener(overlay, 'click', handleClose, 'class-mastery-overlay');
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  blockClicksFor(panel, 300);
  close.focus();
}

// 📓 Run-history modal. `entries` is an array of records from
// state.runHistory (most recent first). `getClass` is the lookup
// function from roguelike.js so we can render the class icon + name.
export function showRunHistory({ entries, getClass, onClose }) {
  const overlay = document.getElementById('run-history-overlay');
  const panel = document.getElementById('run-history-panel');
  const list = document.getElementById('run-history-list');
  const empty = document.getElementById('run-history-empty');
  const close = document.getElementById('run-history-close');
  if (!overlay || !panel || !list || !close) return;
  captureFocus();
  list.innerHTML = '';
  if (!entries || entries.length === 0) {
    if (empty) empty.classList.remove('hidden');
  } else {
    if (empty) empty.classList.add('hidden');
    for (const e of entries) {
      const row = document.createElement('div');
      const isWin = e.outcome === 'complete';
      const cls = e.class ? (getClass ? getClass(e.class) : null) : null;
      const date = e.ts ? new Date(e.ts) : null;
      const dateStr = date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
      const dailyChip = e.daily ? '<span class="px-2 py-0.5 rounded-full bg-purple-300 text-black font-bold text-sm">🌅 DAILY</span>' : '';
      const outcomeChip = isWin
        ? '<span class="px-2 py-0.5 rounded-full bg-yellow-300 text-black font-bold text-sm">🏆 WIN</span>'
        : `<span class="px-2 py-0.5 rounded-full bg-gray-200 text-gray-900 font-bold text-sm">Slot ${e.slot}/100</span>`;
      row.className = 'border-2 border-black rounded-xl p-3 bg-amber-50 flex flex-col gap-1';
      row.innerHTML = `
        <div class="flex items-center gap-2 flex-wrap">
          ${outcomeChip}
          ${dailyChip}
          <span class="font-bold text-gray-900">${cls ? `${escapeHtml(cls.icon)} ${escapeHtml(cls.name)}` : escapeHtml(e.class || '—')}</span>
          <span class="ml-auto text-sm text-gray-700">${escapeHtml(dateStr)}</span>
        </div>
        <div class="flex items-center gap-3 text-base">
          <span>💎 <span class="font-bold tabular-nums">${e.gems}</span></span>
          <span>Score <span class="font-bold tabular-nums">${(e.score || 0).toLocaleString()}</span></span>
        </div>
      `;
      list.appendChild(row);
    }
  }
  const handleClose = () => {
    overlay.classList.add('hidden');
    panel.classList.add('hidden');
    restoreFocus();
    if (onClose) onClose();
  };
  replaceListener(close, 'click', handleClose, 'run-history-close');
  replaceListener(overlay, 'click', handleClose, 'run-history-overlay');
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  blockClicksFor(panel, 300);
  close.focus();
}

export function showSkillTree({ skills, gems, owned, onBuy, onClose, stats }) {
  const overlay = document.getElementById('skill-tree-overlay');
  const panel = document.getElementById('skill-tree-panel');
  const list = document.getElementById('skill-tree-list');
  const gemsEl = document.getElementById('skill-tree-gems');
  const closeBtn = document.getElementById('skill-tree-close');
  if (!overlay || !panel || !list) return;
  captureFocus();

  const render = () => {
    if (stats) {
      const bossLine = stats.bossesDefeated ? ` · ${stats.bossesDefeated} bosses slain` : '';
      gemsEl.innerHTML = `${gems()} 💎 <span class="text-sm font-semibold text-gray-700 ml-2">— ${stats.runs || 0} runs · ${stats.completes || 0} completes · best slot ${stats.bestSlot || 0}${bossLine}</span>`;
    } else {
      gemsEl.textContent = `${gems()} 💎`;
    }
    list.innerHTML = '';
    for (const skill of skills) {
      const isOwned = owned().has(skill.id);
      const canAfford = gems() >= skill.cost;
      const row = document.createElement('div');
      row.className = `flex items-center gap-3 p-3 border-[3px] border-black rounded-2xl ${isOwned ? 'bg-green-100' : canAfford ? 'bg-white' : 'bg-gray-200'}`;
      row.innerHTML = `
        <div class="flex-1">
          <div class="flex items-center gap-2 text-lg sm:text-xl font-bold">
            ${skill.name}
            ${isOwned ? '<span class="text-sm font-bold uppercase tracking-wider text-green-700">Owned</span>' : ''}
          </div>
          <div class="text-base sm:text-lg text-gray-900">${skill.desc}</div>
        </div>
        ${isOwned ? '' : `<button type="button" data-skill="${skill.id}" class="text-base sm:text-lg font-bold bg-yellow-300 hover:bg-yellow-200 active:bg-yellow-400 border-[3px] border-black rounded-2xl px-4 py-3 disabled:bg-gray-300 disabled:text-gray-700 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-500" ${canAfford ? '' : 'disabled'}>${skill.cost} 💎</button>`}
      `;
      list.appendChild(row);
    }
    for (const btn of list.querySelectorAll('button[data-skill]')) {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-skill');
        if (onBuy(id)) render();
      });
    }
  };

  const close = () => {
    overlay.classList.add('hidden');
    panel.classList.add('hidden');
    restoreFocus();
    if (onClose) onClose();
  };
  // Use replaceListener so re-opening the panel without closing it
  // first doesn't stack duplicate listeners on the persistent buttons.
  replaceListener(closeBtn, 'click', close, 'skill-tree-close');
  replaceListener(overlay, 'click', close, 'skill-tree-overlay');

  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  render();
}

export function showRunSummary({ outcome, klass, slotReached, totalSlots, gemsEarned, totalGems, bestSlot, archetypes, archCounts, relics, getRelic, awakened, runsCompleted, classStats, inProgress, upgradesList, getUpgrade, onReplay, onClose: onCloseCb, highlights }) {
  const overlay = document.getElementById('run-summary-overlay');
  const panel = document.getElementById('run-summary-panel');
  if (!overlay || !panel) return;
  captureFocus();
  const tier = document.getElementById('run-summary-tier');
  const title = document.getElementById('run-summary-title');
  const stats = document.getElementById('run-summary-stats');
  const klassEl = document.getElementById('run-summary-class');
  const builds = document.getElementById('run-summary-builds');
  const relicsEl = document.getElementById('run-summary-relics');
  const close = document.getElementById('run-summary-close');
  const isComplete = outcome === 'complete';
  if (tier) tier.textContent = isComplete
    ? '🏆 Run complete'
    : inProgress ? '📋 Run inventory' : 'Run over';
  if (title) title.textContent = isComplete
    ? 'You crowned the Candy Kraken!'
    : inProgress
      ? (slotReached > totalSlots ? `Slot ${slotReached} ♾` : `Slot ${slotReached}/${totalSlots}`)
      : (slotReached > totalSlots ? `You reached slot ${slotReached} (Endless)` : `You reached slot ${slotReached}`);
  if (stats) {
    // 🏅 Extended end-of-run stats. Hide the section entirely when no
    // run is in progress / no data; otherwise render whatever fields
    // are populated. PC-roguelike players love stat-stalking.
    const has = (v) => v != null && v > 0;
    const cards = [];
    if (highlights && has(highlights.maxCascade)) {
      cards.push(`
      <div class="text-center bg-purple-100 border-2 border-black rounded-xl p-2">
        <div class="text-sm font-bold uppercase text-gray-900">🔁 Max cascade</div>
        <div class="text-2xl font-bold tabular-nums">×${highlights.maxCascade}</div>
      </div>`);
    }
    if (highlights && has(highlights.biggestMatch)) {
      cards.push(`
      <div class="text-center bg-orange-100 border-2 border-black rounded-xl p-2">
        <div class="text-sm font-bold uppercase text-gray-900">💥 Biggest match</div>
        <div class="text-2xl font-bold tabular-nums">${highlights.biggestMatch}</div>
      </div>`);
    }
    if (highlights && has(highlights.totalMatches)) {
      cards.push(`
      <div class="text-center bg-teal-100 border-2 border-black rounded-xl p-2">
        <div class="text-sm font-bold uppercase text-gray-900">🎯 Matches</div>
        <div class="text-2xl font-bold tabular-nums">${highlights.totalMatches.toLocaleString()}</div>
      </div>`);
    }
    if (highlights && has(highlights.bestSlotScore)) {
      cards.push(`
      <div class="text-center bg-amber-100 border-2 border-black rounded-xl p-2">
        <div class="text-sm font-bold uppercase text-gray-900">🏔 Best slot score</div>
        <div class="text-2xl font-bold tabular-nums">${highlights.bestSlotScore.toLocaleString()}</div>
      </div>`);
    }
    if (highlights && has(highlights.infiniteCount)) {
      cards.push(`
      <div class="text-center bg-fuchsia-100 border-2 border-black rounded-xl p-2">
        <div class="text-sm font-bold uppercase text-gray-900">♾ Infinites</div>
        <div class="text-2xl font-bold tabular-nums">×${highlights.infiniteCount}</div>
      </div>`);
    }
    const highlightCards = cards.join('');
    stats.innerHTML = `
      <div class="text-center bg-yellow-100 border-2 border-black rounded-xl p-2">
        <div class="text-sm font-bold uppercase text-gray-900">Slot reached</div>
        <div class="text-2xl font-bold tabular-nums">${slotReached}/${totalSlots}</div>
      </div>
      <div class="text-center bg-pink-100 border-2 border-black rounded-xl p-2">
        <div class="text-sm font-bold uppercase text-gray-900">💎 Earned</div>
        <div class="text-2xl font-bold tabular-nums">+${gemsEarned}</div>
      </div>
      <div class="text-center bg-blue-100 border-2 border-black rounded-xl p-2">
        <div class="text-sm font-bold uppercase text-gray-900">💎 Total</div>
        <div class="text-2xl font-bold tabular-nums">${totalGems}</div>
      </div>
      <div class="text-center bg-green-100 border-2 border-black rounded-xl p-2">
        <div class="text-sm font-bold uppercase text-gray-900">Best slot</div>
        <div class="text-2xl font-bold tabular-nums">${bestSlot}</div>
      </div>
      ${highlightCards}
    `;
  }
  if (klassEl) {
    const awakenStr = awakened ? ' <span class="px-2 py-0.5 rounded-full bg-pink-700 text-white text-sm font-bold">✨ AWAKENED</span>' : '';
    const statsStr = classStats
      ? ` <span class="text-sm text-gray-700">— Run #${classStats.runs}, ${classStats.completes} wins, best slot ${classStats.bestSlot}</span>`
      : '';
    klassEl.innerHTML = klass ? `Class: ${escapeHtml(klass.icon)} ${escapeHtml(klass.name)}${awakenStr}${statsStr}` : '';
  }
  if (builds) {
    builds.innerHTML = '';
    if (archCounts && archetypes) {
      for (const key of Object.keys(archCounts)) {
        const n = archCounts[key];
        if (n > 0) {
          const meta = archetypes[key];
          if (meta) {
            const chip = document.createElement('span');
            chip.className = 'px-2 py-1 rounded-full border-2 border-black font-bold text-sm';
            // Solid colored bg + contrast-aware text for WCAG AA readability.
            chip.style.background = meta.color;
            chip.style.color = contrastTextOn(meta.color);
            chip.textContent = `${meta.icon} ${meta.name} ×${n}`;
            builds.appendChild(chip);
          }
        }
      }
    }
    // When in-progress (inventory view), also list individual upgrades
    // by name with their stack counts and archetype colour.
    if (inProgress && upgradesList && upgradesList.length > 0 && getUpgrade) {
      const counts = new Map();
      for (const id of upgradesList) counts.set(id, (counts.get(id) || 0) + 1);
      const divider = document.createElement('div');
      divider.className = 'w-full text-sm font-bold uppercase tracking-wider text-gray-700 text-center mt-1';
      divider.textContent = 'Upgrades held';
      builds.appendChild(divider);
      for (const [id, n] of counts) {
        const u = getUpgrade(id);
        if (!u) continue;
        const arch = u.archetype && archetypes ? archetypes[u.archetype] : null;
        const color = arch ? arch.color : '#444';
        const row = document.createElement('span');
        // Tier names: 1=base, 2=II, 3=III, 4=IV, 5+=MAX
        const tier = n >= 5 ? 'MAX' : (n === 4 ? 'IV' : (n === 3 ? 'III' : (n === 2 ? 'II' : '')));
        const isMax = n >= 5;
        // Upgrade rows: white bg with colored left-border accent for normal,
        // solid colored bg for MAX. Black text in both cases for readability.
        row.className = `px-2 py-1 rounded-lg border-2 border-black text-sm ${isMax ? 'font-bold' : ''}`;
        row.style.background = isMax ? color : '#fff';
        row.style.color = isMax ? contrastTextOn(color) : '#000';
        row.style.borderLeftWidth = '6px';
        row.style.borderLeftColor = color;
        const tierBadge = tier ? ` <span class="font-semibold">[${tier}]</span>` : '';
        row.innerHTML = `${arch ? escapeHtml(arch.icon) : '•'} ${escapeHtml(u.name)}${n > 1 ? ` ×${n}` : ''}${tierBadge}`;
        row.title = u.desc || '';
        builds.appendChild(row);
      }
    }
  }
  if (relicsEl) {
    relicsEl.innerHTML = '';
    if (relics && relics.length > 0) {
      if (inProgress) {
        // Full-description inline list for the in-run inventory view.
        relicsEl.className = 'flex flex-col items-stretch gap-1 text-sm';
        for (const id of relics) {
          const r = getRelic ? getRelic(id) : null;
          const row = document.createElement('div');
          row.className = 'flex items-center gap-2 border-2 border-yellow-700 bg-yellow-50 rounded-lg px-2 py-1';
          row.innerHTML = r
            ? `<span class="text-xl">${escapeHtml(r.icon)}</span><span class="font-bold text-gray-900">${escapeHtml(r.name)}</span><span class="text-sm text-gray-800">— ${escapeHtml(r.desc)}</span>`
            : `<span class="text-gray-900">${escapeHtml(id)}</span>`;
          relicsEl.appendChild(row);
        }
      } else {
        relicsEl.className = 'flex flex-wrap items-center justify-center gap-1 text-2xl';
        const label = document.createElement('span');
        label.className = 'text-sm font-semibold text-gray-700 mr-1 self-center';
        label.textContent = 'Relics:';
        relicsEl.appendChild(label);
        for (const id of relics) {
          const r = getRelic ? getRelic(id) : null;
          const s = document.createElement('span');
          s.title = r ? `${r.name}: ${r.desc}` : id;
          s.textContent = r ? r.icon : '?';
          relicsEl.appendChild(s);
        }
      }
    }
  }
  const handleClose = () => {
    overlay.classList.add('hidden');
    panel.classList.add('hidden');
    restoreFocus();
    if (onCloseCb) onCloseCb();
  };
  replaceListener(close, 'click', handleClose, 'run-summary-close');
  replaceListener(overlay, 'click', handleClose, 'run-summary-overlay');
  // 🔁 New run button — only meaningful for outcome === 'complete' or 'fail'.
  const replayBtn = document.getElementById('run-summary-replay');
  if (replayBtn) {
    if (onReplay && !inProgress) {
      replayBtn.style.display = '';
      replayBtn.onclick = () => {
        overlay.classList.add('hidden');
        panel.classList.add('hidden');
        onReplay();
      };
    } else {
      replayBtn.style.display = 'none';
      replayBtn.onclick = null;
    }
  }
  // 📤 Share button — tries the native Web Share API first (iOS / Android
  // PWA install gets the system share sheet), falls back to clipboard
  // copy on desktop / unsupported browsers. Either way the player gets
  // their run summary out of the game and into a chat / tweet / post.
  const shareBtn = document.getElementById('run-summary-share');
  if (shareBtn) {
    shareBtn.onclick = async () => {
      const klassStr = klass ? `${klass.icon} ${klass.name}` : 'Wanderer';
      const archStr = archCounts && archetypes
        ? Object.keys(archCounts)
            .filter((k) => archCounts[k] > 0)
            .map((k) => `${archetypes[k].icon}${archCounts[k]}`)
            .join(' ')
        : '';
      const relicStr = relics && relics.length > 0
        ? relics.map((id) => (getRelic && getRelic(id) ? getRelic(id).icon : '?')).join('')
        : 'none';
      const lines = [
        `🔮 Arcana Cascada — ${outcome === 'complete' ? '🏆 READING COMPLETE' : 'Card ' + slotReached + '/' + totalSlots}`,
        `Class: ${klassStr}${awakened ? ' ✨ AWAKENED' : ''}`,
        `Build: ${archStr || '—'}`,
        `Relics: ${relicStr}`,
        `💎 +${gemsEarned} (total ${totalGems})`,
      ];
      const text = lines.join('\n');
      const original = shareBtn.textContent;
      // Try Web Share API first — produces the native share sheet on
      // mobile (most useful path for a PWA).
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title: 'Arcana Cascada reading', text });
          shareBtn.textContent = '✅ Shared!';
          setTimeout(() => { shareBtn.textContent = original; }, 1500);
          return;
        } catch (err) {
          // Aborted by user, or share failed — fall through to clipboard.
          if (err && err.name === 'AbortError') {
            shareBtn.textContent = original;
            return;
          }
        }
      }
      // Clipboard fallback.
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          shareBtn.textContent = '✅ Copied!';
        } else {
          shareBtn.textContent = '⚠ Copy failed';
        }
      } catch {
        shareBtn.textContent = '⚠ Copy failed';
      }
      setTimeout(() => { shareBtn.textContent = original; }, 1500);
    };
  }
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  blockClicksFor(panel, 600);
  close.focus();
}

export function flashMutatorActivation() {
  const flash = document.createElement('div');
  flash.className = 'mutator-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1000);
}

export function showBossDefeatedBanner(boss, { isFinal = false, holdMs = 2200 } = {}) {
  const root = document.getElementById('boss-banner');
  if (!root) return Promise.resolve();
  const tier = document.getElementById('boss-banner-tier');
  const icon = document.getElementById('boss-banner-icon');
  const name = document.getElementById('boss-banner-name');
  const tip = document.getElementById('boss-banner-tip');
  if (tier) tier.textContent = isFinal ? 'YOU WIN!' : 'BOSS DEFEATED';
  if (name) name.textContent = `🏆 ${(boss && boss.name) || 'Boss'} falls!`;
  if (icon) icon.textContent = isFinal ? '👑' : '🏆';
  if (tip) tip.textContent = isFinal
    ? 'You crowned the Candy Kraken. Run complete.'
    : 'Pick your relic. The run continues.';
  // Tint the card gold/green for victory rather than the red boss tones.
  const card = root.querySelector('.boss-banner-card');
  if (card) {
    card.classList.remove('from-pink-700', 'via-red-700', 'to-purple-800');
    card.classList.add('from-yellow-500', 'via-amber-600', 'to-pink-600');
  }
  root.classList.remove('hidden', 'fading');
  root.classList.add('show');
  return new Promise((resolve) => {
    setTimeout(() => {
      root.classList.remove('show');
      root.classList.add('fading');
      setTimeout(() => {
        root.classList.add('hidden');
        root.classList.remove('fading');
        // Restore the boss-banner styling for next intro.
        if (card) {
          card.classList.remove('from-yellow-500', 'via-amber-600', 'to-pink-600');
          card.classList.add('from-pink-700', 'via-red-700', 'to-purple-800');
        }
        resolve();
      }, 350);
    }, holdMs);
  });
}

export function showBossBanner(boss, { isFinal = false, holdMs = isFinal ? 4200 : 3000 } = {}) {
  const root = document.getElementById('boss-banner');
  if (!root) return Promise.resolve();
  const tier = document.getElementById('boss-banner-tier');
  const icon = document.getElementById('boss-banner-icon');
  const name = document.getElementById('boss-banner-name');
  const tip = document.getElementById('boss-banner-tip');
  if (tier) tier.textContent = isFinal ? 'FINAL BOSS' : 'BOSS BATTLE';
  if (name) name.textContent = (boss && boss.name) || 'Boss';
  // Pick an icon based on boss id (matches the in-game lore naming).
  const iconByBossId = {
    'boss-1': '🍮', 'boss-2': '🔒', 'boss-3': '👑',
    'boss-4': '🐌', 'boss-5': '🗿', 'boss-6': '🍒',
    'boss-7': '👻', 'boss-8': '🕷', 'boss-9': '🧁',
    'boss-10': '🐙',
  };
  if (icon) icon.textContent = iconByBossId[boss && boss.id] || (isFinal ? '🐙' : '👑');
  const taunt = document.getElementById('boss-banner-taunt');
  if (taunt) {
    const t = boss && boss.taunt;
    if (t) {
      taunt.textContent = `“${t}”`;
      taunt.classList.remove('hidden');
    } else {
      taunt.textContent = '';
      taunt.classList.add('hidden');
    }
  }
  if (tip) tip.textContent = (boss && boss.tip) || '';
  root.classList.remove('hidden', 'fading');
  root.classList.add('show');
  return new Promise((resolve) => {
    setTimeout(() => {
      root.classList.remove('show');
      root.classList.add('fading');
      setTimeout(() => {
        root.classList.add('hidden');
        root.classList.remove('fading');
        resolve();
      }, 350);
    }, holdMs);
  });
}

// Map dominant archetype counts to a fun "playstyle" label shown
// on the run HUD as a colored chip prefix.
function dominantBuildVibe(archCounts, archetypes) {
  if (!archCounts || !archetypes) return null;
  const entries = Object.entries(archCounts).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (total < 3) return null; // wait till there's a real build
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  const second = entries[1] || [null, 0];
  // Polymath if no single archetype dominates AND 3+ archetypes are represented.
  if (entries.length >= 3 && top[1] === second[1]) {
    return { label: '🌈 Polymath', color: '#a855f7', title: `Mixed build — ${entries.length} archetypes` };
  }
  const labels = {
    bomber:  { label: '🔥 Demolisher',  title: 'Bomber-dominant — boom & bust.' },
    lucky:   { label: '🍀 Charmlord',   title: 'Lucky-dominant — Lucky-MODE machine.' },
    scorer:  { label: '🎯 Glass Cannon',title: 'Scorer-dominant — every match weighs gold.' },
    sustain: { label: '🛡 Bastion',     title: 'Sustain-dominant — never run out.' },
    wild:    { label: '🌪 Chaos Mage',  title: 'Wild-dominant — auto-fire abilities everywhere.' },
  };
  const meta = labels[top[0]];
  if (!meta) return null;
  const arch = archetypes[top[0]];
  return { label: meta.label, color: arch ? arch.color : '#444', title: meta.title };
}

export function setRunHud({ visible, klass, archCounts, archetypes, relics, getRelic, slot, totalSlots, mutator, awakened, nextMilestone }) {
  const root = document.getElementById('run-hud');
  if (!root) return;
  if (!visible) { root.classList.add('hidden'); return; }
  root.classList.remove('hidden');
  // Make the whole HUD obviously clickable.
  root.style.cursor = 'pointer';
  root.title = 'Tap to see your full build (upgrades + relics + class)';
  const klassEl = document.getElementById('run-hud-class');
  const buildsEl = document.getElementById('run-hud-builds');
  const relicsEl = document.getElementById('run-hud-relics');
  if (klassEl) {
    const slotStr = (slot != null && totalSlots) ? `<span class="text-gray-700 font-semibold">${slot}/${totalSlots}</span> · ` : '';
    const awakenedStr = awakened && klass
      ? ` <span class="px-2 py-0.5 rounded-full font-bold bg-pink-700 text-white border-2 border-black animate-pulse" title="${escapeHtml(klass.awaken || '')}">✨ AWAKENED</span>`
      : '';
    const mutStr = mutator
      ? ` · <span class="mutator-chip mutator-chip-active px-2 rounded-full font-bold bg-yellow-300 text-black border-2 border-black" title="${escapeHtml(mutator.desc)}">${escapeHtml(mutator.icon)} ${escapeHtml(mutator.name)}</span>`
      : '';
    const nextStr = nextMilestone
      ? ` · <span class="text-base font-semibold text-gray-900">Next: ${escapeHtml(nextMilestone.icon)} ${escapeHtml(nextMilestone.label)} in ${escapeHtml(nextMilestone.distance)}</span>`
      : '';
    klassEl.innerHTML = `${slotStr}${klass ? `${escapeHtml(klass.icon)} ${escapeHtml(klass.name)}` : '🎲 No class'}${awakenedStr}${mutStr}${nextStr}`;
  }
  if (buildsEl && archCounts && archetypes) {
    const tags = [];
    for (const key of Object.keys(archCounts)) {
      const n = archCounts[key];
      if (n > 0) {
        const meta = archetypes[key];
        if (meta) tags.push(`<span class="px-2 rounded-full border-2 border-black font-bold" style="background:${meta.color};color:${contrastTextOn(meta.color)}">${escapeHtml(meta.icon)}${n}</span>`);
      }
    }
    const vibe = dominantBuildVibe(archCounts, archetypes);
    const vibeChip = vibe
      ? `<span class="px-2 rounded-full border-2 border-black font-bold mr-1" style="background:${vibe.color};color:${contrastTextOn(vibe.color)}" title="${escapeHtml(vibe.title)}">${escapeHtml(vibe.label)}</span>`
      : '';
    buildsEl.innerHTML = tags.length ? `${vibeChip}${tags.join('')}` : '<span class="text-gray-800 font-semibold">No upgrades yet</span>';
  }
  if (relicsEl) {
    const buildChip = '<span class="px-2 py-0.5 rounded-full bg-black text-white text-sm font-bold border-2 border-yellow-400 ml-1" title="Tap the HUD for full build details">📋 BUILD</span>';
    if (relics && relics.length > 0) {
      const icons = relics.map((id) => {
        const r = getRelic ? getRelic(id) : null;
        return r ? `<span title="${escapeHtml(r.name + ': ' + r.desc)}">${escapeHtml(r.icon)}</span>` : '';
      }).join('');
      relicsEl.innerHTML = `<span class="text-sm font-semibold text-gray-900 mr-1">Relics:</span>${icons}${buildChip}`;
    } else {
      relicsEl.innerHTML = `<span class="text-sm font-semibold text-gray-800">No relics yet — beat a boss</span>${buildChip}`;
    }
  }
}

export function showRelicPicker(choices, ownedRelics, onPick) {
  const overlay = document.getElementById('upgrade-overlay');
  const panel = document.getElementById('upgrade-panel');
  const list = document.getElementById('upgrade-choices');
  const active = document.getElementById('upgrade-active-list');
  const subtitle = document.getElementById('upgrade-subtitle');
  const title = document.getElementById('upgrade-title');
  if (!overlay || !panel || !list) return;
  const prevSubtitle = subtitle?.textContent;
  const prevTitle = title?.textContent;
  if (subtitle) subtitle.textContent = 'Boss reward';
  if (title) title.textContent = 'Choose a RELIC — one of a kind, lasts the run';
  list.innerHTML = '';
  const prevGridClass = list.className;
  list.className = 'grid grid-cols-1 sm:grid-cols-3 gap-3';
  for (const r of choices) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'upgrade-card relic-card flex flex-col gap-1 p-4 text-left border-[3px] border-yellow-600 rounded-2xl bg-gradient-to-br from-yellow-50 to-amber-100 hover:from-yellow-100 hover:to-amber-200 active:from-yellow-200 active:to-amber-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-500 shadow-md';
    btn.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-3xl">${escapeHtml(r.icon)}</span>
        <span class="text-lg sm:text-xl font-bold">${escapeHtml(r.name)}</span>
        <span class="text-sm font-bold uppercase tracking-wider ml-auto text-yellow-800">RELIC</span>
      </div>
      <span class="text-base sm:text-lg text-gray-900">${escapeHtml(r.desc)}</span>
    `;
    btn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      panel.classList.add('hidden');
      if (subtitle) subtitle.textContent = prevSubtitle || 'Choose an upgrade';
      if (title) title.textContent = prevTitle || 'Pick one to take into your next slot';
      list.className = prevGridClass;
      onPick(r);
    });
    list.appendChild(btn);
  }
  if (active) {
    if (ownedRelics && ownedRelics.length > 0) {
      active.textContent = `Held relics: ${ownedRelics.map((id) => id).join(' · ')}`;
    } else {
      active.textContent = 'Your first relic — it stays with you for the rest of the run.';
    }
  }
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  blockClicksFor(panel, 600);
  const firstBtn = list.querySelector('button');
  if (firstBtn) firstBtn.focus();
}

// Mid-run merchant — three fixed items. `onBuy(item)` returns true if
// purchase was successful (gems spent + effect applied). Player can
// buy any/all they can afford then press Continue.
// Mid-run "crossroads" event — 3 hard-coded options, pick one and
// the chosen effect is applied via onPick. Lighter weight than the
// merchant since there's no cost and no continue button.
export function showCrossroadsEvent({ options, onPick }) {
  const overlay = document.getElementById('upgrade-overlay');
  const panel = document.getElementById('upgrade-panel');
  const list = document.getElementById('upgrade-choices');
  const subtitle = document.getElementById('upgrade-subtitle');
  const title = document.getElementById('upgrade-title');
  if (!overlay || !panel || !list) { if (onPick) onPick(options[0]); return; }
  const prevSubtitle = subtitle?.textContent;
  const prevTitle = title?.textContent;
  const prevGridClass = list.className;
  if (subtitle) subtitle.textContent = '✨ The Crossroads';
  if (title) title.textContent = 'Pick one — a brief detour before the next slot';
  list.className = 'grid grid-cols-1 sm:grid-cols-3 gap-3';
  list.innerHTML = '';
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'upgrade-card flex flex-col gap-2 p-4 text-left border-[3px] border-purple-700 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-100 hover:from-purple-100 hover:to-pink-200 active:from-purple-200 active:to-pink-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-500 shadow-md';
    btn.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-3xl">${escapeHtml(opt.icon)}</span>
        <span class="text-lg font-bold">${escapeHtml(opt.name)}</span>
      </div>
      <div class="text-sm text-gray-800">${escapeHtml(opt.desc)}</div>
    `;
    btn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      panel.classList.add('hidden');
      if (subtitle) subtitle.textContent = prevSubtitle || 'Choose an upgrade';
      if (title) title.textContent = prevTitle || 'Pick one to take into your next slot';
      list.className = prevGridClass;
      if (onPick) onPick(opt);
    });
    list.appendChild(btn);
  }
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  blockClicksFor(panel, 600);
}

export function showShop({ items, getGems, onBuy, onContinue }) {
  const overlay = document.getElementById('upgrade-overlay');
  const panel = document.getElementById('upgrade-panel');
  const list = document.getElementById('upgrade-choices');
  const active = document.getElementById('upgrade-active-list');
  const subtitle = document.getElementById('upgrade-subtitle');
  const title = document.getElementById('upgrade-title');
  if (!overlay || !panel || !list) { if (onContinue) onContinue(); return; }
  const prevSubtitle = subtitle?.textContent;
  const prevTitle = title?.textContent;
  const prevGridClass = list.className;
  if (subtitle) subtitle.textContent = '🛒 The Merchant';
  if (title) title.textContent = 'Spend gems on per-run boosts.';
  list.className = 'flex flex-col gap-3';
  const render = () => {
    list.innerHTML = '';
    for (const it of items) {
      const gems = getGems();
      const afford = gems >= it.cost;
      const row = document.createElement('button');
      row.type = 'button';
      row.disabled = !afford;
      row.className = `text-left flex items-center gap-3 p-3 border-[3px] border-black rounded-2xl ${afford ? 'bg-white hover:bg-amber-50 active:bg-amber-100' : 'bg-gray-200 text-gray-700 cursor-not-allowed'}`;
      row.innerHTML = `
        <span class="text-3xl">${escapeHtml(it.icon)}</span>
        <span class="flex-1">
          <span class="block text-lg font-bold">${escapeHtml(it.name)}</span>
          <span class="block text-sm text-gray-700">${escapeHtml(it.desc)}</span>
        </span>
        <span class="px-3 py-2 bg-yellow-300 border-2 border-black rounded-xl font-bold">${escapeHtml(String(it.cost))} 💎</span>
      `;
      row.addEventListener('click', () => {
        if (!afford) return;
        if (onBuy(it)) render();
      });
      list.appendChild(row);
    }
    const cont = document.createElement('button');
    cont.type = 'button';
    cont.className = 'mt-2 self-center px-6 py-3 bg-yellow-400 text-black border-[3px] border-black rounded-2xl font-bold text-lg active:translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-500';
    cont.textContent = 'Continue';
    cont.addEventListener('click', () => {
      overlay.classList.add('hidden');
      panel.classList.add('hidden');
      if (subtitle) subtitle.textContent = prevSubtitle || 'Choose an upgrade';
      if (title) title.textContent = prevTitle || 'Pick one to take into your next slot';
      list.className = prevGridClass;
      if (onContinue) onContinue();
    });
    list.appendChild(cont);
    if (active) active.textContent = `You have ${getGems()} 💎`;
  };
  render();
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
}

// Roguelike intro tour. Old design dumped 5 dense cards on the player
// at once — gameplay review flagged this as a D1 churn risk. New
// design: same 5 concepts, but step through them ONE at a time with
// Prev / Next / Skip controls so the player can chew on each idea
// before moving on. "Skip" jumps straight to class pick for returning
// players or anyone who'd rather discover the rest in play.
const INTRO_STEPS = [
  {
    bg: 'bg-amber-50 border-amber-700',
    icon: '⚔',
    title: 'CLASS',
    body: 'Pick 1 of 11 classes at run start. Each grants a free starting upgrade and unlocks a unique passive (your AWAKENING) once you stack 2+ upgrades of its archetype.',
  },
  {
    bg: 'bg-purple-50 border-purple-700',
    icon: '🧬',
    title: 'UPGRADES + SYNERGY',
    body: 'Pick 1 upgrade between slots. Cards belong to 5 archetypes (🎯 Scorer · 💣 Bomber · 🍀 Lucky · 🛡 Sustain · ⚡ Wild). Stack the same archetype for SYNERGY bonuses and your class awakening.',
  },
  {
    bg: 'bg-yellow-50 border-yellow-700',
    icon: '👑',
    title: 'BOSSES + RELICS',
    body: 'Every 10 slots is a BOSS — each has its own mechanic (jelly regen, lock harden, wraith heal, …). Beat one and pick 1 of 3 random RELICS. Relics rewrite your run.',
  },
  {
    bg: 'bg-pink-50 border-pink-700',
    icon: '🌪',
    title: 'MUTATORS',
    body: 'Every 5 slots (skipping bosses), a random MUTATOR rolls — a one-slot buff like ☀️ Golden Hour (×2 score) or 🍀 Lucky Day (Lucky bar starts full). Pure upside.',
  },
  {
    bg: 'bg-gray-100 border-gray-700',
    icon: '🦷🪨',
    title: 'ENEMIES',
    body: 'The Eater (slot 9+) chomps the top of a random column every few moves. Grumblock (slot 50+) wanders the board, locking tiles. Both are telegraphed so you can plan around them.',
  },
];

export function showRoguelikeIntro(onProceed) {
  const overlay = document.getElementById('upgrade-overlay');
  const panel = document.getElementById('upgrade-panel');
  const list = document.getElementById('upgrade-choices');
  const active = document.getElementById('upgrade-active-list');
  const subtitle = document.getElementById('upgrade-subtitle');
  const title = document.getElementById('upgrade-title');
  if (!overlay || !panel || !list) { if (onProceed) onProceed(); return; }
  const prevSubtitle = subtitle?.textContent;
  const prevTitle = title?.textContent;
  const prevGridClass = list.className;
  let step = 0;
  const total = INTRO_STEPS.length;

  function finish() {
    overlay.classList.add('hidden');
    panel.classList.add('hidden');
    if (subtitle) subtitle.textContent = prevSubtitle || 'Choose an upgrade';
    if (title) title.textContent = prevTitle || 'Pick one to take into your next slot';
    list.className = prevGridClass;
    if (onProceed) onProceed();
  }

  function render() {
    const s = INTRO_STEPS[step];
    if (subtitle) subtitle.textContent = `Welcome to Roguelike! (${step + 1} of ${total})`;
    if (title) title.textContent = `${s.icon} ${s.title}`;
    list.className = 'flex flex-col gap-3 text-base sm:text-lg';
    const isLast = step === total - 1;
    list.innerHTML = `
      <div class="${s.bg} border-2 rounded-xl p-4 text-gray-900 text-lg">
        ${s.body}
      </div>
      <div class="flex w-full gap-2 mt-1">
        <button id="intro-prev" class="flex-1 text-base sm:text-lg font-bold bg-white hover:bg-gray-100 border-2 border-black rounded-xl px-4 py-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-500 ${step === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${step === 0 ? 'disabled' : ''}>← Back</button>
        <button id="intro-skip" class="flex-1 text-base sm:text-lg font-bold bg-white hover:bg-gray-100 border-2 border-black rounded-xl px-4 py-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-500">Skip — I know how to play</button>
        <button id="intro-next" class="flex-1 text-base sm:text-lg font-bold bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black rounded-xl px-4 py-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-500">${isLast ? "Let's go — pick my class →" : 'Next →'}</button>
      </div>
      <div class="flex justify-center gap-1.5 mt-1" aria-hidden="true">
        ${INTRO_STEPS.map((_, i) => `<span class="w-2 h-2 rounded-full ${i === step ? 'bg-black' : 'bg-gray-300'}"></span>`).join('')}
      </div>
    `;
    const prevBtn = list.querySelector('#intro-prev');
    const nextBtn = list.querySelector('#intro-next');
    const skipBtn = list.querySelector('#intro-skip');
    if (prevBtn && step > 0) prevBtn.addEventListener('click', () => { step--; render(); });
    if (skipBtn) skipBtn.addEventListener('click', finish);
    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (isLast) { finish(); return; }
      step++;
      render();
    });
    nextBtn?.focus();
  }

  if (active) active.textContent = '';
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  render();
}

export function showClassPicker(classes, archetypes, onPick, classStats = null) {
  const overlay = document.getElementById('upgrade-overlay');
  const panel = document.getElementById('upgrade-panel');
  const list = document.getElementById('upgrade-choices');
  const active = document.getElementById('upgrade-active-list');
  const subtitle = document.getElementById('upgrade-subtitle');
  const title = document.getElementById('upgrade-title');
  if (!overlay || !panel || !list) return;
  const prevSubtitle = subtitle?.textContent;
  const prevTitle = title?.textContent;
  if (subtitle) subtitle.textContent = 'Choose your class';
  if (title) title.textContent = 'Each class starts you with a free upgrade';
  list.innerHTML = '';
  // Class picker uses a 2-column grid so 6 cards fit nicely.
  const prevGridClass = list.className;
  list.className = 'grid grid-cols-1 sm:grid-cols-2 gap-3';
  for (const cls of classes) {
    const arch = cls.archetype && archetypes ? archetypes[cls.archetype] : null;
    const color = arch ? arch.color : '#FFD60A';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'upgrade-card class-card flex flex-col gap-1 p-4 text-left border-[3px] border-black rounded-2xl bg-white hover:bg-amber-50 active:bg-amber-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-500 shadow-md';
    btn.style.borderColor = '#000';
    const stats = classStats && classStats[cls.id] ? classStats[cls.id] : null;
    const statsLine = stats
      ? `<span class="text-xs text-gray-600">📊 Run #${(stats.runs || 0) + 1} · ${stats.completes || 0} ✓ · best slot ${stats.bestSlot || 0}</span>`
      : '<span class="text-sm text-gray-700 font-semibold">Never played — your first run.</span>';
    btn.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-2xl">${escapeHtml(cls.icon)}</span>
        <span class="text-lg sm:text-xl font-bold">${escapeHtml(cls.name)}</span>
        ${arch ? `<span class="text-xs font-bold uppercase tracking-wider ml-auto" style="color:${color}">${escapeHtml(arch.icon)} ${escapeHtml(arch.name)}</span>` : ''}
      </div>
      <span class="text-base sm:text-lg text-gray-900">${escapeHtml(cls.desc)}</span>
      ${cls.awaken ? `<span class="text-xs font-bold text-pink-700">✨ ${escapeHtml(cls.awaken)}</span>` : ''}
      ${statsLine}
    `;
    btn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      panel.classList.add('hidden');
      // Restore the picker UI to its upgrade-picker state.
      if (subtitle) subtitle.textContent = prevSubtitle || 'Choose an upgrade';
      if (title) title.textContent = prevTitle || 'Pick one to take into your next slot';
      list.className = prevGridClass;
      onPick(cls);
    });
    list.appendChild(btn);
  }
  if (active) active.textContent = 'Your class shapes the run. You can still pick any upgrade later.';
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  const firstBtn = list.querySelector('button');
  if (firstBtn) firstBtn.focus();
}

export function showUpgradePicker(choices, activeIds, onPick, categoryColor, archetypes, archCounts, onReroll = null, awakenInfo = null) {
  const overlay = document.getElementById('upgrade-overlay');
  const panel = document.getElementById('upgrade-panel');
  const list = document.getElementById('upgrade-choices');
  const active = document.getElementById('upgrade-active-list');
  if (!overlay || !panel || !list) return;
  list.innerHTML = '';
  for (const u of choices) {
    const arch = u.archetype && archetypes ? archetypes[u.archetype] : null;
    const stacks = (archCounts && u.archetype) ? (archCounts[u.archetype] || 0) : 0;
    const willStack = stacks + 1;
    const synergyHint = arch && willStack >= 2
      ? `<span class="text-xs font-bold" style="color:${arch.color}">Synergy ${willStack}× — ${arch.desc}</span>`
      : '';
    // If this pick would cross the player's class-awakening threshold,
    // call it out so they can chase the synergy on purpose.
    let awakenHint = '';
    if (awakenInfo && !awakenInfo.alreadyAwakened) {
      const wouldAwaken =
        (awakenInfo.archetype && u.archetype === awakenInfo.archetype && willStack === awakenInfo.threshold) ||
        (awakenInfo.anyUpgrade && (awakenInfo.totalCount + 1) === awakenInfo.threshold);
      if (wouldAwaken) {
        awakenHint = '<span class="text-xs font-bold text-pink-700 animate-pulse">✨ This pick AWAKENS your class!</span>';
      }
    }
    const archBadge = arch
      ? `<span class="text-xs font-bold uppercase tracking-wider" style="color:${arch.color}">${arch.icon} ${arch.name}${stacks > 0 ? ` ×${willStack}` : ''}</span>`
      : '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'upgrade-card flex flex-col gap-1 p-4 text-left border-[3px] border-black rounded-2xl bg-white hover:bg-amber-50 active:bg-amber-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-500 shadow-md';
    btn.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        ${archBadge}
        <span class="text-sm font-bold uppercase tracking-wider" style="color:${categoryColor(u.category)}">${u.category}</span>
      </div>
      <span class="text-lg sm:text-xl font-bold">${escapeHtml(u.name)}</span>
      <span class="text-base sm:text-lg text-gray-900">${escapeHtml(u.desc)}</span>
      ${synergyHint}
      ${awakenHint}
    `;
    btn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      panel.classList.add('hidden');
      onPick(u);
    });
    list.appendChild(btn);
  }
  if (active) {
    if (archCounts && archetypes) {
      const tags = [];
      for (const key of Object.keys(archCounts)) {
        const n = archCounts[key];
        if (n > 0) {
          const meta = archetypes[key];
          if (meta) tags.push(`<span style="color:${meta.color}">${meta.icon}${meta.name} ×${n}</span>`);
        }
      }
      active.innerHTML = tags.length ? `Build: ${tags.join(' · ')}` : 'No build yet — your first pick sets the tone.';
    } else if (activeIds && activeIds.length > 0) {
      const counts = new Map();
      for (const id of activeIds) counts.set(id, (counts.get(id) || 0) + 1);
      const parts = [];
      for (const [id, n] of counts) parts.push(n > 1 ? `${id} ×${n}` : id);
      active.textContent = `Active: ${parts.join(' · ')}`;
    } else {
      active.textContent = 'No upgrades yet — this is your first pick.';
    }
  }
  // Reroll button — if provided, append after the choices. Clicking
  // invokes onReroll which is expected to call showUpgradePicker
  // again with fresh choices.
  if (onReroll) {
    const reroll = document.createElement('button');
    reroll.type = 'button';
    reroll.id = 'upgrade-reroll';
    reroll.className = 'upgrade-reroll mt-2 sm:col-span-3 self-stretch px-4 py-3 bg-gray-100 border-[3px] border-black rounded-xl text-base font-bold hover:bg-gray-200 active:translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-500';
    reroll.innerHTML = '🔄 Reroll choices · costs 1 Shuffle';
    reroll.addEventListener('click', () => {
      reroll.disabled = true;
      onReroll();
    });
    list.appendChild(reroll);
  }
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  blockClicksFor(panel, 600);
  const firstBtn = list.querySelector('button:not(#upgrade-reroll)');
  if (firstBtn) firstBtn.focus();
}

let comboHideTimer = null;
export function setComboMeter(level) {
  const el = document.getElementById('combo-meter');
  if (!el) return;
  if (!level || level < 2) {
    el.classList.add('hidden');
    return;
  }
  el.textContent = `CHAIN ×${level}`;
  el.classList.remove('hidden');
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  clearTimeout(comboHideTimer);
  comboHideTimer = setTimeout(() => el.classList.add('hidden'), 1800);
}

export function setLuckyCharge(pct, opts = false) {
  // Back-compat: setLuckyCharge(pct, true) -> { ready: true }
  let ready = false, mode = false, remaining = 0, total = 0;
  if (typeof opts === 'boolean') {
    ready = opts;
  } else if (opts && typeof opts === 'object') {
    ready = !!opts.ready; mode = !!opts.mode;
    remaining = opts.remaining || 0; total = opts.total || 0;
  }
  const fill = document.getElementById('lucky-fill');
  const label = document.getElementById('lucky-label');
  const bar = document.getElementById('lucky-bar');
  if (!fill || !label || !bar) return;
  if (mode) {
    fill.style.width = '100%';
    label.textContent = `LUCKY ×1.5 · ${remaining}/${total}`;
    bar.classList.remove('lucky-ready');
    bar.classList.add('lucky-mode');
    return;
  }
  bar.classList.remove('lucky-mode');
  fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  if (ready) {
    label.textContent = 'READY · TRIPLE!';
    bar.classList.add('lucky-ready');
  } else {
    label.textContent = `${Math.round(pct)}%`;
    bar.classList.remove('lucky-ready');
  }
}

export function showChangelog(items, onDismiss) {
  const overlay = document.getElementById('changelog-overlay');
  const panel = document.getElementById('changelog-panel');
  const list = document.getElementById('changelog-list');
  const btn = document.getElementById('changelog-dismiss');
  if (!overlay || !panel || !list || !btn) {
    if (onDismiss) onDismiss();
    return;
  }
  captureFocus();
  list.innerHTML = '';
  // Accept either a flat array of strings (legacy) or an array of
  // changelog ENTRIES { id, items }. Entries get a small version label.
  const isEntries = Array.isArray(items) && items.length > 0 && typeof items[0] === 'object' && Array.isArray(items[0].items);
  if (isEntries) {
    for (let i = 0; i < items.length; i++) {
      const entry = items[i];
      const header = document.createElement('li');
      header.style.listStyle = 'none';
      header.className = 'mt-3 mb-1 text-sm font-bold uppercase tracking-wider text-gray-700';
      header.textContent = i === 0 ? `Today — ${entry.id}` : entry.id;
      list.appendChild(header);
      for (const text of entry.items) {
        const li = document.createElement('li');
        li.textContent = text;
        list.appendChild(li);
      }
    }
  } else {
    for (const text of items) {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    }
  }
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  btn.focus();
  const dismiss = () => {
    overlay.classList.add('hidden');
    panel.classList.add('hidden');
    restoreFocus();
    if (onDismiss) onDismiss();
  };
  replaceListener(btn, 'click', dismiss, 'changelog-dismiss');
  replaceListener(overlay, 'click', dismiss, 'changelog-overlay');
}

// IDs of modal overlays + panels that should be closed when a "top-level"
// menu (start menu) takes over the screen. Prevents the start menu from
// stacking on top of a leftover run-summary/level/settings panel.
const MODAL_OVERLAY_IDS = [
  'run-summary-overlay', 'run-summary-panel',
  'level-overlay',
  'level-intro',
  'level-select-overlay', 'level-select-panel',
  'settings-overlay', 'settings-panel',
  'changelog-overlay', 'changelog-panel',
  'welcome-overlay', 'welcome-panel',
  'upgrade-overlay', 'upgrade-panel',
  'skill-tree-overlay', 'skill-tree-panel',
  'reset-overlay', 'reset-panel',
  'relic-overlay', 'relic-panel',
  'shop-overlay', 'shop-panel',
  'crossroads-overlay', 'crossroads-panel',
  'class-picker-overlay', 'class-picker-panel',
  'roguelike-intro-overlay', 'roguelike-intro-panel',
  'boss-banner',
  'goodbye-screen',
];

export function hideAllOverlays({ except = [] } = {}) {
  const skip = new Set(except);
  for (const id of MODAL_OVERLAY_IDS) {
    if (skip.has(id)) continue;
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }
  // Also hide level-complete/level-fail sub-panels nested inside level-overlay.
  if (!skip.has('level-overlay')) {
    const c = document.getElementById('level-complete');
    const f = document.getElementById('level-fail');
    if (c) c.classList.add('hidden');
    if (f) f.classList.add('hidden');
  }
  // Resolve any pending level-intro promise so a 🏠 mid-intro doesn't
  // leak the awaiter forever.
  if (!skip.has('level-intro') && introResolve) {
    const r = introResolve;
    introResolve = null;
    try { r(); } catch { /* ignore */ }
  }
}

// Show the start menu (mode-picker). Each `on*` is invoked when the
// player taps that mode button; `subtitle` is optional flavor text
// (e.g. "Run over — pick where to go next" on game-over).
export function showStartMenu({ onRoguelike, onDaily, onLevels, onFreePlay, onSettings, onHelp, onQuit, onResume, onAbandon, onAscensionCycle, subtitle, stats, version, runInProgress, dailyStatus, ascension }) {
  const screen = document.getElementById('start-screen');
  const btnAsc = document.getElementById('start-menu-ascension');
  const btnRogue = document.getElementById('start-menu-roguelike');
  const btnDaily = document.getElementById('start-menu-daily');
  const btnLevels = document.getElementById('start-menu-levels');
  const btnFree = document.getElementById('start-menu-free');
  const btnSettings = document.getElementById('start-menu-settings');
  const btnHelp = document.getElementById('start-menu-help');
  const btnQuit = document.getElementById('start-menu-quit');
  const btnResume = document.getElementById('start-menu-resume');
  const btnAbandon = document.getElementById('start-menu-abandon');
  const subEl = document.getElementById('start-screen-subtitle');
  const statsEl = document.getElementById('start-screen-stats');
  const versionEl = document.getElementById('start-screen-version');
  if (!screen || !btnRogue || !btnLevels || !btnFree) return;
  // Stats badge row — small chips for best score, runs completed, gems.
  if (statsEl) {
    statsEl.innerHTML = '';
    const chips = [];
    if (stats?.best != null) chips.push({ label: '🏆 Best', value: stats.best.toLocaleString() });
    if (stats?.runsCompleted != null && stats.runsCompleted > 0) chips.push({ label: '⚔ Runs', value: stats.runsCompleted });
    if (stats?.gems != null && stats.gems > 0) chips.push({ label: '💎', value: stats.gems });
    if (chips.length > 0) {
      statsEl.classList.remove('hidden');
      statsEl.classList.add('flex');
      for (const c of chips) {
        const chip = document.createElement('span');
        chip.className = 'px-2 py-1 bg-white/70 border border-gray-400 rounded-full font-bold';
        chip.textContent = `${c.label} ${c.value}`;
        statsEl.appendChild(chip);
      }
    } else {
      statsEl.classList.add('hidden');
      statsEl.classList.remove('flex');
    }
  }
  if (versionEl) versionEl.textContent = version ? `v${version}` : '';
  // Close any in-flight modals (run summary, settings, etc.) — the
  // start screen is a top-level page, not a stack-on-top dialog.
  hideAllOverlays({ except: ['start-screen'] });
  if (subEl) subEl.textContent = subtitle || '';
  const hide = () => {
    screen.classList.add('hidden');
    document.body.classList.remove('start-screen-active');
  };
  const wrap = (fn) => () => { hide(); if (fn) fn(); };
  // 📂 Resume affordance — surfaced when a roguelike run is in progress.
  // The Resume button takes the player straight back to their slot;
  // Abandon forfeits (awards gems for slots reached) and unhides the
  // normal "⚔ Roguelike Run" entry for a fresh start.
  if (btnResume && btnAbandon) {
    if (runInProgress) {
      // Endless Mode (slot > totalSlots) reads weird as "Slot 137 / 100".
      // Switch to "Slot 137 ♾" when the player is past the standard cap.
      const slotStr = runInProgress.slot && runInProgress.totalSlots
        ? (runInProgress.slot > runInProgress.totalSlots
            ? ` · Slot ${runInProgress.slot} ♾`
            : ` · Slot ${runInProgress.slot} / ${runInProgress.totalSlots}`)
        : '';
      const classStr = runInProgress.classIcon
        ? `${runInProgress.classIcon} `
        : '';
      btnResume.innerHTML = `▶ Resume ${classStr}Run${slotStr}`;
      btnResume.classList.remove('hidden');
      btnAbandon.classList.remove('hidden');
      // Hide the regular "Roguelike Run" button to prevent confusion —
      // the player must Resume or Abandon first.
      btnRogue.classList.add('hidden');
    } else {
      btnResume.classList.add('hidden');
      btnAbandon.classList.add('hidden');
      btnRogue.classList.remove('hidden');
    }
    replaceListener(btnResume, 'click', wrap(onResume), 'start-menu-resume');
    replaceListener(btnAbandon, 'click', () => { if (onAbandon) onAbandon(); }, 'start-menu-abandon');
  }
  replaceListener(btnRogue, 'click', wrap(onRoguelike), 'start-menu-rogue');
  // 🆙 Ascension chip — only visible after the player has unlocked
  // ascension 1+ (i.e. cleared their first run). Tap to cycle through
  // the unlocked levels (0 → 1 → 2 → 3 → 0).
  if (btnAsc) {
    if (ascension && ascension.unlocked > 0 && !runInProgress) {
      btnAsc.innerHTML = `🆙 ${ascension.label} ↕`;
      btnAsc.classList.remove('hidden');
      replaceListener(btnAsc, 'click', () => { if (onAscensionCycle) onAscensionCycle(); }, 'start-menu-ascension');
    } else {
      btnAsc.classList.add('hidden');
    }
  }
  if (btnDaily) {
    // Daily-seed button: shows today's date label + a small badge if
    // the player already played today (so they know it'll show "best
    // slot X" on completion, no double-rewards). Always visible —
    // hiding it during a non-daily run had the (correctly reported)
    // failure mode of "I picked Roguelike Run this morning and now
    // the daily is gone for the rest of the day." Clicking the daily
    // while a NON-daily run is in progress prompts a confirmation
    // before abandoning the existing run, so the player still can't
    // accidentally lose mid-run progress.
    const stampStr = dailyStatus?.stamp ? ` · ${dailyStatus.stamp}` : '';
    const playedStr = dailyStatus?.playedToday
      ? ` ✓ Slot ${dailyStatus.bestSlot || 0}`
      : '';
    btnDaily.innerHTML = `🌅 Today's Daily Seed${stampStr}${playedStr}`;
    btnDaily.classList.remove('hidden');
    const dailyHandler = () => {
      // Confirmation gate must use the RUN'S type, not the daily-badge
      // status. `playedToday` only tells us whether today's daily was
      // ever completed (or partly played) — it says nothing about
      // whether the current in-flight run is the daily. If a player
      // cleared the daily this morning and is now mid-Roguelike,
      // `playedToday=true` but `runIsDaily=false`, and clicking Daily
      // would silently abandon real progress. Gate on isDaily.
      const inNonDailyRun = !!runInProgress && !runInProgress.isDaily;
      if (inNonDailyRun) {
        const ok = (typeof window !== 'undefined' && window.confirm)
          ? window.confirm('Abandon your current run and start today\'s daily seed?')
          : true;
        if (!ok) return;
      }
      if (onDaily) onDaily();
    };
    replaceListener(btnDaily, 'click', wrap(dailyHandler), 'start-menu-daily');
  }
  replaceListener(btnLevels, 'click', wrap(onLevels), 'start-menu-levels');
  replaceListener(btnFree, 'click', wrap(onFreePlay), 'start-menu-free');
  // Settings / Help open their own modals on top of the start screen.
  // We DON'T dismiss the start screen here — closing those modals returns
  // the player to the start screen, which is the expected flow on a
  // proper game title screen.
  if (btnSettings) replaceListener(btnSettings, 'click', () => { if (onSettings) onSettings(); }, 'start-menu-settings');
  if (btnHelp) replaceListener(btnHelp, 'click', () => { if (onHelp) onHelp(); }, 'start-menu-help');
  if (btnQuit) replaceListener(btnQuit, 'click', () => { if (onQuit) onQuit(); }, 'start-menu-quit');
  screen.classList.remove('hidden');
  document.body.classList.add('start-screen-active');
  blockClicksFor(screen, 400);
  // Focus the resume button if it's visible (run in progress); otherwise
  // the regular Roguelike entry point.
  if (runInProgress && btnResume) btnResume.focus();
  else btnRogue.focus();
}

// "Thanks for playing" screen shown when the player taps Quit Game.
// Web apps can't truly exit, so we present this as the final state with
// a button to bounce back to the start screen if they change their mind.
export function showGoodbye(onReturn) {
  const screen = document.getElementById('goodbye-screen');
  const startScreen = document.getElementById('start-screen');
  const btn = document.getElementById('goodbye-return');
  if (!screen || !btn) return;
  if (startScreen) startScreen.classList.add('hidden');
  document.body.classList.add('start-screen-active'); // keep game UI hidden
  screen.classList.remove('hidden');
  replaceListener(btn, 'click', () => {
    screen.classList.add('hidden');
    if (onReturn) onReturn();
  }, 'goodbye-return');
  btn.focus();
}

export function hideStartMenu() {
  const screen = document.getElementById('start-screen');
  if (screen) screen.classList.add('hidden');
  document.body.classList.remove('start-screen-active');
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
let introResolve = null;
let introOverlayListener = null;
export function showLevelIntro(level, totalLevels = 8, opts = {}) {
  const overlay = document.getElementById('level-intro');
  const card = document.getElementById('level-intro-card');
  if (!overlay || !card || !level) return Promise.resolve();
  document.getElementById('li-tag').textContent = `Level ${level.id} of ${totalLevels}`;
  document.getElementById('li-name').textContent = level.name;
  document.getElementById('li-hint').textContent = level.hint;
  document.getElementById('li-moves').textContent =
    level.moves === 1 ? '1 move' : `${level.moves} moves`;
  const bestEl = document.getElementById('li-best');
  if (bestEl) {
    const stars = opts.bestStars || 0;
    const score = opts.bestScore || 0;
    if (stars > 0 || score > 0) {
      const starStr = stars > 0 ? '★'.repeat(stars) : '';
      const scoreStr = score > 0 ? `${score.toLocaleString()} pts` : '';
      bestEl.textContent = `Your best: ${starStr}${stars > 0 && score > 0 ? '  ' : ''}${scoreStr}`;
      bestEl.classList.remove('hidden');
    } else {
      bestEl.classList.add('hidden');
    }
  }
  const tipEl = document.getElementById('li-tip');
  if (tipEl) {
    if (level.tip) {
      tipEl.textContent = `Tip: ${level.tip}`;
      tipEl.classList.remove('hidden');
    } else {
      tipEl.classList.add('hidden');
    }
  }
  // Reveal + animate in
  overlay.classList.remove('hidden');
  overlay.classList.remove('show');
  void overlay.offsetWidth;
  overlay.classList.add('show');

  // Resolve any pending promise so callers don't leak.
  if (introResolve) { try { introResolve(); } catch {} introResolve = null; }
  if (introOverlayListener) {
    overlay.removeEventListener('click', introOverlayListener);
    introOverlayListener = null;
  }

  return new Promise((resolve) => {
    introResolve = resolve;
    const dismiss = () => {
      if (!introResolve) return;
      clearTimeout(introTimer);
      overlay.classList.remove('show');
      overlay.classList.add('closing');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('closing');
      }, 280);
      if (introOverlayListener) {
        overlay.removeEventListener('click', introOverlayListener);
        introOverlayListener = null;
      }
      const r = introResolve;
      introResolve = null;
      r();
    };
    introOverlayListener = dismiss;
    // Block clicks for 400ms so the intro can't be tapped through by
    // accident before the player has had a chance to read it. After that,
    // it stays open until they actually tap.
    overlay.style.pointerEvents = 'none';
    setTimeout(() => {
      overlay.style.pointerEvents = '';
      overlay.addEventListener('click', dismiss);
    }, 400);
    clearTimeout(introTimer);
    // Safety net: if the player walks away mid-intro, dismiss after a
    // long timeout so the game doesn't get stuck.
    introTimer = setTimeout(dismiss, 60000);
  });
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

  title.textContent = isLast
    ? `Level ${level.id} complete — you've cleared every level so far!`
    : `Level ${level.id} complete!`;
  // score can be a number (normal completion) or a string label like "∞+1"
  // (infinite-combo auto-win). Format gracefully.
  scoreEl.textContent = `Score: ${typeof score === 'number' ? score.toLocaleString() : String(score)}`;
  nextBtn.textContent = isLast ? 'Play again' : 'Next level';

  // Build three star spans with stagger delays so earned stars
  // animate in one by one ("Angry Birds" style).
  starsEl.innerHTML = '';
  starsEl.setAttribute('aria-label', `${stars} of 3 stars`);
  for (let i = 1; i <= 3; i++) {
    const s = document.createElement('span');
    s.className = 'lc-star';
    const isEarned = i <= stars;
    s.textContent = isEarned ? '★' : '☆';
    s.style.setProperty('--star-delay', `${(i - 1) * 320}ms`);
    if (isEarned) s.classList.add('earned');
    starsEl.appendChild(s);
  }

  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  blockClicksFor(panel, 600);

  // Reveal animation re-trigger
  starsEl.classList.remove('reveal');
  void starsEl.offsetWidth;
  starsEl.classList.add('reveal');

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
  blockClicksFor(panel, 600);

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

export function applyTheme({ contrast, size, reduceMotion, mode }) {
  const body = document.body;
  body.classList.toggle('theme-hc', !!contrast);
  body.classList.toggle('reduce-motion', !!reduceMotion);
  body.classList.toggle('mode-roguelike', mode === 'roguelike');
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
