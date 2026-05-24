import { LEVELS as ALL_LEVELS } from '../game/levels.js';

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
      if (state.jellyMap) {
        const j = state.jellyMap.get(cellKey(c, r));
        if (j === 2) tile.classList.add('jelly', 'jelly-2');
        else if (j === 1) tile.classList.add('jelly', 'jelly-1');
      }
      if (state.lockMap) {
        const lk = state.lockMap.get(cellKey(c, r));
        if (lk && lk > 0) {
          tile.classList.add('locked');
          if (lk === 2) tile.classList.add('locked-2');
          const badge = document.createElement('span');
          badge.className = 'lock-badge';
          badge.setAttribute('aria-hidden', 'true');
          badge.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" fill="#FFD60A" stroke="#000" stroke-width="2"/>
            <path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="15" r="1.5" fill="#000"/>
          </svg>${lk === 2 ? '<span class="lock-hits">2</span>' : ''}`;
          tile.appendChild(badge);
        }
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
    chip.textContent = `Run Slot ${slot} / ${total}${boss} · ${gems}💎`;
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

export function showSkillTree({ skills, gems, owned, onBuy, onClose }) {
  const overlay = document.getElementById('skill-tree-overlay');
  const panel = document.getElementById('skill-tree-panel');
  const list = document.getElementById('skill-tree-list');
  const gemsEl = document.getElementById('skill-tree-gems');
  const closeBtn = document.getElementById('skill-tree-close');
  if (!overlay || !panel || !list) return;

  const render = () => {
    gemsEl.textContent = `${gems()} 💎`;
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

export function showUpgradePicker(choices, activeIds, onPick, categoryColor) {
  const overlay = document.getElementById('upgrade-overlay');
  const panel = document.getElementById('upgrade-panel');
  const list = document.getElementById('upgrade-choices');
  const active = document.getElementById('upgrade-active-list');
  if (!overlay || !panel || !list) return;
  list.innerHTML = '';
  for (const u of choices) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'upgrade-card flex flex-col gap-1 p-4 text-left border-[3px] border-black rounded-2xl bg-white hover:bg-amber-50 active:bg-amber-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-500 shadow-md';
    btn.innerHTML = `
      <span class="text-xs font-bold uppercase tracking-wider" style="color:${categoryColor(u.category)}">${u.category}</span>
      <span class="text-lg sm:text-xl font-bold">${u.name}</span>
      <span class="text-sm sm:text-base text-gray-700">${u.desc}</span>
    `;
    btn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      panel.classList.add('hidden');
      onPick(u);
    });
    list.appendChild(btn);
  }
  if (active && activeIds && activeIds.length > 0) {
    const counts = new Map();
    for (const id of activeIds) counts.set(id, (counts.get(id) || 0) + 1);
    const parts = [];
    for (const [id, n] of counts) parts.push(n > 1 ? `${id} ×${n}` : id);
    active.textContent = `Active: ${parts.join(' · ')}`;
  } else if (active) {
    active.textContent = 'No upgrades yet — this is your first pick.';
  }
  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  const firstBtn = list.querySelector('button');
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

export function setLuckyCharge(pct, ready = false) {
  const fill = document.getElementById('lucky-fill');
  const label = document.getElementById('lucky-label');
  const bar = document.getElementById('lucky-bar');
  if (!fill || !label || !bar) return;
  fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  if (ready) {
    label.textContent = 'READY!';
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
  for (const text of items) {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
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

export function applyTheme({ contrast, size, reduceMotion }) {
  const body = document.body;
  body.classList.toggle('theme-hc', !!contrast);
  body.classList.toggle('reduce-motion', !!reduceMotion);
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
