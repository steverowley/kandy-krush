import { LEVELS as ALL_LEVELS } from '../game/levels.js';

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
      // Flat-top hexagon — very distinct from the pink triangle so the
      // orange tile reads at a glance.
      return `<polygon points="22,22 78,22 92,50 78,78 22,78 8,50" fill="${fill}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>`;
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

export function renderBoard(board, state, opts = {}) {
  const root = document.getElementById('board');
  const fallenSet = opts.fallen
    ? new Set(opts.fallen.map((p) => cellKey(p.c, p.r)))
    : null;
  const introDrop = !!opts.intro;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const cell = board.cell(c, r);
      const tile = document.createElement('button');
      tile.className = 'tile';
      if (introDrop) {
        tile.classList.add('intro-drop');
        tile.style.setProperty('--intro-delay', `${c * 40 + r * 20}ms`);
      }
      tile.dataset.c = String(c);
      tile.dataset.r = String(r);
      tile.type = 'button';
      tile.setAttribute('role', 'gridcell');
      tile.setAttribute('aria-label', ariaForCell(cell, c, r));
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
            // 🪨 — wandering enemy. Distinct rock SVG.
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
      frag.appendChild(tile);
    }
  }
  root.replaceChildren(frag);
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

let scoreRollFrame = null;
export function setScore(n, { animate = false } = {}) {
  const el = document.getElementById('score');
  if (!el) return;
  const old = Number(el.textContent.replace(/,/g, '')) || 0;
  if (animate && n > old) {
    if (scoreRollFrame) cancelAnimationFrame(scoreRollFrame);
    const start = old;
    const end = n;
    const t0 = performance.now();
    const duration = Math.min(700, 220 + (end - start) * 1.2);
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

export function showSkillTree({ skills, gems, owned, onBuy, onClose, stats }) {
  const overlay = document.getElementById('skill-tree-overlay');
  const panel = document.getElementById('skill-tree-panel');
  const list = document.getElementById('skill-tree-list');
  const gemsEl = document.getElementById('skill-tree-gems');
  const closeBtn = document.getElementById('skill-tree-close');
  if (!overlay || !panel || !list) return;

  const render = () => {
    if (stats) {
      const bossLine = stats.bossesDefeated ? ` · ${stats.bossesDefeated} bosses slain` : '';
      gemsEl.innerHTML = `${gems()} 💎 <span class="text-sm font-normal opacity-70 ml-2">— ${stats.runs || 0} runs · ${stats.completes || 0} completes · best slot ${stats.bestSlot || 0}${bossLine}</span>`;
    } else {
      gemsEl.textContent = `${gems()} 💎`;
    }
    list.innerHTML = '';
    for (const skill of skills) {
      const isOwned = owned().has(skill.id);
      const canAfford = gems() >= skill.cost;
      const row = document.createElement('div');
      row.className = `flex items-center gap-3 p-3 border-[3px] border-black rounded-2xl ${isOwned ? 'bg-green-100' : canAfford ? 'bg-white' : 'bg-gray-100 opacity-60'}`;
      row.innerHTML = `
        <div class="flex-1">
          <div class="flex items-center gap-2 text-lg sm:text-xl font-bold">
            ${skill.name}
            ${isOwned ? '<span class="text-sm font-bold uppercase tracking-wider text-green-700">Owned</span>' : ''}
          </div>
          <div class="text-sm sm:text-base text-gray-700">${skill.desc}</div>
        </div>
        ${isOwned ? '' : `<button type="button" data-skill="${skill.id}" class="text-base sm:text-lg font-bold bg-yellow-300 hover:bg-yellow-200 active:bg-yellow-400 border-[3px] border-black rounded-2xl px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed" ${canAfford ? '' : 'disabled'}>${skill.cost} 💎</button>`}
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
    closeBtn.removeEventListener('click', close);
    overlay.removeEventListener('click', close);
    if (onClose) onClose();
  };
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);

  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  render();
}

export function showRunSummary({ outcome, klass, slotReached, totalSlots, gemsEarned, totalGems, bestSlot, archetypes, archCounts, relics, getRelic, awakened, runsCompleted, classStats, inProgress, upgradesList, getUpgrade, onReplay, highlights }) {
  const overlay = document.getElementById('run-summary-overlay');
  const panel = document.getElementById('run-summary-panel');
  if (!overlay || !panel) return;
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
    : inProgress ? `Slot ${slotReached}/${totalSlots}` : `You reached slot ${slotReached}`;
  if (stats) {
    const highlightCards = highlights && (highlights.maxCascade > 0 || highlights.biggestMatch > 0)
      ? `
      <div class="text-center bg-purple-100 border-2 border-black rounded-xl p-2">
        <div class="text-xs uppercase opacity-70">🔁 Max cascade</div>
        <div class="text-2xl font-bold tabular-nums">×${highlights.maxCascade || 0}</div>
      </div>
      <div class="text-center bg-orange-100 border-2 border-black rounded-xl p-2">
        <div class="text-xs uppercase opacity-70">💥 Biggest match</div>
        <div class="text-2xl font-bold tabular-nums">${highlights.biggestMatch || 0}</div>
      </div>`
      : '';
    stats.innerHTML = `
      <div class="text-center bg-yellow-100 border-2 border-black rounded-xl p-2">
        <div class="text-xs uppercase opacity-70">Slot reached</div>
        <div class="text-2xl font-bold tabular-nums">${slotReached}/${totalSlots}</div>
      </div>
      <div class="text-center bg-pink-100 border-2 border-black rounded-xl p-2">
        <div class="text-xs uppercase opacity-70">💎 Earned</div>
        <div class="text-2xl font-bold tabular-nums">+${gemsEarned}</div>
      </div>
      <div class="text-center bg-blue-100 border-2 border-black rounded-xl p-2">
        <div class="text-xs uppercase opacity-70">💎 Total</div>
        <div class="text-2xl font-bold tabular-nums">${totalGems}</div>
      </div>
      <div class="text-center bg-green-100 border-2 border-black rounded-xl p-2">
        <div class="text-xs uppercase opacity-70">Best slot</div>
        <div class="text-2xl font-bold tabular-nums">${bestSlot}</div>
      </div>
      ${highlightCards}
    `;
  }
  if (klassEl) {
    const awakenStr = awakened ? ' <span class="px-2 rounded-full bg-pink-500 text-white text-xs">✨ AWAKENED</span>' : '';
    const statsStr = classStats
      ? ` <span class="text-xs opacity-70">— Run #${classStats.runs}, ${classStats.completes} wins, best slot ${classStats.bestSlot}</span>`
      : '';
    klassEl.innerHTML = klass ? `Class: ${klass.icon} ${klass.name}${awakenStr}${statsStr}` : '';
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
            chip.style.background = `${meta.color}22`;
            chip.style.color = meta.color;
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
      divider.className = 'w-full text-xs uppercase tracking-wider opacity-60 text-center mt-1';
      divider.textContent = 'Upgrades held';
      builds.appendChild(divider);
      for (const [id, n] of counts) {
        const u = getUpgrade(id);
        if (!u) continue;
        const arch = u.archetype && archetypes ? archetypes[u.archetype] : null;
        const color = arch ? arch.color : '#444';
        const row = document.createElement('span');
        row.className = 'px-2 py-1 rounded-lg border-2 border-black text-xs';
        row.style.background = `${color}11`;
        row.style.color = color;
        row.textContent = `${arch ? arch.icon : '•'} ${u.name}${n > 1 ? ` ×${n}` : ''}`;
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
          row.className = 'flex items-center gap-2 border border-yellow-500 bg-yellow-50 rounded-lg px-2 py-1';
          row.innerHTML = r
            ? `<span class="text-xl">${r.icon}</span><span class="font-bold">${r.name}</span><span class="opacity-80 text-xs">— ${r.desc}</span>`
            : `<span>${id}</span>`;
          relicsEl.appendChild(row);
        }
      } else {
        relicsEl.className = 'flex flex-wrap items-center justify-center gap-1 text-2xl';
        const label = document.createElement('span');
        label.className = 'text-xs opacity-70 mr-1 self-center';
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
    close.removeEventListener('click', handleClose);
    overlay.removeEventListener('click', handleClose);
  };
  close.addEventListener('click', handleClose);
  overlay.addEventListener('click', handleClose);
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
  // 📋 Copy summary button — builds a clipboard-friendly text recap.
  const shareBtn = document.getElementById('run-summary-share');
  if (shareBtn) {
    shareBtn.onclick = () => {
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
        `Sweet Match — ${outcome === 'complete' ? '🏆 RUN COMPLETE' : 'Slot ' + slotReached + '/' + totalSlots}`,
        `Class: ${klassStr}${awakened ? ' ✨ AWAKENED' : ''}`,
        `Build: ${archStr || '—'}`,
        `Relics: ${relicStr}`,
        `💎 +${gemsEarned} (total ${totalGems})`,
      ];
      const text = lines.join('\n');
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text);
          shareBtn.textContent = '✅ Copied!';
        } else {
          shareBtn.textContent = '⚠ Copy failed';
        }
      } catch {
        shareBtn.textContent = '⚠ Copy failed';
      }
      setTimeout(() => { shareBtn.textContent = '📋 Copy summary'; }, 1500);
    };
  }
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
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

export function showBossBanner(boss, { isFinal = false, holdMs = 1900 } = {}) {
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
  const klassEl = document.getElementById('run-hud-class');
  const buildsEl = document.getElementById('run-hud-builds');
  const relicsEl = document.getElementById('run-hud-relics');
  if (klassEl) {
    const slotStr = (slot != null && totalSlots) ? `<span class="opacity-70">${slot}/${totalSlots}</span> · ` : '';
    const awakenedStr = awakened && klass
      ? ` <span class="px-2 rounded-full font-bold bg-pink-500 text-white border-2 border-black animate-pulse" title="${klass.awaken ? klass.awaken.replace(/"/g, '') : ''}">✨ AWAKENED</span>`
      : '';
    const mutStr = mutator
      ? ` · <span class="mutator-chip mutator-chip-active px-2 rounded-full font-bold bg-yellow-300 text-black border-2 border-black" title="${mutator.desc.replace(/"/g, '')}">${mutator.icon} ${mutator.name}</span>`
      : '';
    const nextStr = nextMilestone
      ? ` · <span class="text-xs opacity-80">Next: ${nextMilestone.icon} ${nextMilestone.label} in ${nextMilestone.distance}</span>`
      : '';
    klassEl.innerHTML = `${slotStr}${klass ? `${klass.icon} ${klass.name}` : '🎲 No class'}${awakenedStr}${mutStr}${nextStr}`;
  }
  if (buildsEl && archCounts && archetypes) {
    const tags = [];
    for (const key of Object.keys(archCounts)) {
      const n = archCounts[key];
      if (n > 0) {
        const meta = archetypes[key];
        if (meta) tags.push(`<span class="px-2 rounded-full border-2 border-black font-bold" style="background:${meta.color}22;color:${meta.color}">${meta.icon}${n}</span>`);
      }
    }
    const vibe = dominantBuildVibe(archCounts, archetypes);
    const vibeChip = vibe
      ? `<span class="px-2 rounded-full border-2 border-black font-bold mr-1" style="background:${vibe.color};color:white" title="${vibe.title}">${vibe.label}</span>`
      : '';
    buildsEl.innerHTML = tags.length ? `${vibeChip}${tags.join('')}` : '<span class="opacity-60">No upgrades yet</span>';
  }
  if (relicsEl) {
    if (relics && relics.length > 0) {
      const icons = relics.map((id) => {
        const r = getRelic ? getRelic(id) : null;
        return r ? `<span title="${r.name}: ${r.desc.replace(/"/g, '')}">${r.icon}</span>` : '';
      }).join('');
      relicsEl.innerHTML = `<span class="text-xs opacity-70 mr-1">Relics:</span>${icons}`;
    } else {
      relicsEl.innerHTML = '<span class="text-xs opacity-60">No relics yet — beat a boss</span>';
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
        <span class="text-3xl">${r.icon}</span>
        <span class="text-lg sm:text-xl font-bold">${r.name}</span>
        <span class="text-xs font-bold uppercase tracking-wider ml-auto text-yellow-700">RELIC</span>
      </div>
      <span class="text-sm sm:text-base text-gray-700">${r.desc}</span>
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
        <span class="text-3xl">${opt.icon}</span>
        <span class="text-lg font-bold">${opt.name}</span>
      </div>
      <div class="text-sm text-gray-800">${opt.desc}</div>
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
      row.className = `text-left flex items-center gap-3 p-3 border-[3px] border-black rounded-2xl ${afford ? 'bg-white hover:bg-amber-50 active:bg-amber-100' : 'bg-gray-100 opacity-60 cursor-not-allowed'}`;
      row.innerHTML = `
        <span class="text-3xl">${it.icon}</span>
        <span class="flex-1">
          <span class="block text-lg font-bold">${it.name}</span>
          <span class="block text-sm text-gray-700">${it.desc}</span>
        </span>
        <span class="px-3 py-2 bg-yellow-300 border-2 border-black rounded-xl font-bold">${it.cost} 💎</span>
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
  if (subtitle) subtitle.textContent = 'Welcome to Roguelike!';
  if (title) title.textContent = 'Quick run-down before we start';
  list.className = 'flex flex-col gap-2 text-sm sm:text-base';
  list.innerHTML = `
    <div class="bg-amber-50 border-2 border-amber-700 rounded-xl p-3 text-gray-900">
      <div class="font-bold">⚔ CLASS</div>
      <div>Pick 1 of 11 classes at run start. Each grants a free starting upgrade and unlocks a unique passive (your AWAKENING) once you stack 2+ upgrades of its archetype.</div>
    </div>
    <div class="bg-purple-50 border-2 border-purple-700 rounded-xl p-3 text-gray-900">
      <div class="font-bold">🧬 UPGRADES + SYNERGY</div>
      <div>Pick 1 upgrade between slots. Cards belong to 5 archetypes (🎯 Scorer · 💣 Bomber · 🍀 Lucky · 🛡 Sustain · ⚡ Wild). Stack the same archetype for SYNERGY bonuses and your class awakening.</div>
    </div>
    <div class="bg-yellow-50 border-2 border-yellow-700 rounded-xl p-3 text-gray-900">
      <div class="font-bold">👑 RELICS</div>
      <div>Beat a boss (every 10 slots) and choose 1 of 3 random RELICS — rare per-run passives that completely change the feel of your run.</div>
    </div>
    <div class="bg-pink-50 border-2 border-pink-700 rounded-xl p-3 text-gray-900">
      <div class="font-bold">🌪 MUTATORS</div>
      <div>Every 5 slots (skipping bosses), a random MUTATOR rolls — a one-slot buff like ☀️ Golden Hour (×2 score) or 🍀 Lucky Day (Lucky bar starts full). Pure upside.</div>
    </div>
    <div class="bg-gray-100 border-2 border-gray-700 rounded-xl p-3 text-gray-900">
      <div class="font-bold">🦷🪨 ENEMIES</div>
      <div>The Eater (slot 9+) chomps the top of a random column every few moves. Grumblock (slot 50+) wanders the board, locking tiles. Both are telegraphed so you can plan around them.</div>
    </div>
    <button id="intro-go" class="mt-2 px-6 py-3 bg-yellow-400 text-black border-[3px] border-black rounded-2xl font-bold text-lg active:translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-500">Let's go — pick my class</button>
  `;
  const button = list.querySelector('#intro-go');
  button.addEventListener('click', () => {
    overlay.classList.add('hidden');
    panel.classList.add('hidden');
    if (subtitle) subtitle.textContent = prevSubtitle || 'Choose an upgrade';
    if (title) title.textContent = prevTitle || 'Pick one to take into your next slot';
    list.className = prevGridClass;
    if (onProceed) onProceed();
  });
  if (active) active.textContent = '';
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  button.focus();
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
      : '<span class="text-xs text-gray-500 italic">Never played — your first run.</span>';
    btn.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-2xl">${cls.icon}</span>
        <span class="text-lg sm:text-xl font-bold">${cls.name}</span>
        ${arch ? `<span class="text-xs font-bold uppercase tracking-wider ml-auto" style="color:${color}">${arch.icon} ${arch.name}</span>` : ''}
      </div>
      <span class="text-sm sm:text-base text-gray-700">${cls.desc}</span>
      ${cls.awaken ? `<span class="text-xs font-bold text-pink-700">✨ ${cls.awaken}</span>` : ''}
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
        <span class="text-xs font-bold uppercase tracking-wider opacity-60" style="color:${categoryColor(u.category)}">${u.category}</span>
      </div>
      <span class="text-lg sm:text-xl font-bold">${u.name}</span>
      <span class="text-sm sm:text-base text-gray-700">${u.desc}</span>
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
  list.innerHTML = '';
  // Accept either a flat array of strings (legacy) or an array of
  // changelog ENTRIES { id, items }. Entries get a small version label.
  const isEntries = Array.isArray(items) && items.length > 0 && typeof items[0] === 'object' && Array.isArray(items[0].items);
  if (isEntries) {
    for (let i = 0; i < items.length; i++) {
      const entry = items[i];
      const header = document.createElement('li');
      header.style.listStyle = 'none';
      header.className = 'mt-3 mb-1 text-xs font-bold uppercase tracking-wider opacity-70';
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
    btn.removeEventListener('click', dismiss);
    overlay.removeEventListener('click', dismiss);
    if (onDismiss) onDismiss();
  };
  btn.addEventListener('click', dismiss);
  overlay.addEventListener('click', dismiss);
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
    overlay.addEventListener('click', dismiss);
    const dismissAfter = level.tip ? 4400 : 2800;
    clearTimeout(introTimer);
    introTimer = setTimeout(dismiss, dismissAfter);
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
  scoreEl.textContent = `Score: ${score.toLocaleString()}`;
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
