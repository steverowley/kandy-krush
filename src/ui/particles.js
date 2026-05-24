import { CANDY_DEFS } from './render.js';

function layer() {
  return document.getElementById('particles');
}

function tileCenter(c, r) {
  const tile = document.querySelector(`#board .tile[data-c="${c}"][data-r="${r}"]`);
  if (!tile) return null;
  const rect = tile.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    w: rect.width,
    h: rect.height,
  };
}

export function spawnFloatingNumber(text, positions, opts = {}) {
  const root = layer();
  if (!root || positions.length === 0) return;
  let sx = 0,
    sy = 0,
    count = 0;
  for (const p of positions) {
    const pt = tileCenter(p.c, p.r);
    if (!pt) continue;
    sx += pt.x;
    sy += pt.y;
    count++;
  }
  if (count === 0) return;
  const el = document.createElement('div');
  el.className = 'particle particle-float';
  el.textContent = text;
  el.style.left = `${sx / count}px`;
  el.style.top = `${sy / count}px`;
  if (opts.color) el.style.color = opts.color;
  root.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

export function spawnTileSparkles(c, r, count = 8, opts = {}) {
  const root = layer();
  if (!root) return;
  const pt = tileCenter(c, r);
  if (!pt) return;
  const radius = opts.radius || pt.w * 0.7;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = radius * (0.6 + Math.random() * 0.6);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const el = document.createElement('div');
    el.className = 'particle particle-sparkle';
    el.style.left = `${pt.x}px`;
    el.style.top = `${pt.y}px`;
    el.style.setProperty('--dx', `${dx}px`);
    el.style.setProperty('--dy', `${dy}px`);
    if (opts.color) el.style.background = opts.color;
    root.appendChild(el);
    setTimeout(() => el.remove(), 720);
  }
}

export function spawnPopSpecks(positions) {
  const root = layer();
  if (!root) return;
  for (const p of positions) {
    const pt = tileCenter(p.c, p.r);
    if (!pt) continue;
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div');
      el.className = 'particle particle-speck';
      el.style.left = `${pt.x}px`;
      el.style.top = `${pt.y}px`;
      el.style.setProperty('--dx', `${(Math.random() - 0.5) * pt.w * 0.9}px`);
      el.style.setProperty('--dy', `${(Math.random() - 0.5) * pt.h * 0.9}px`);
      root.appendChild(el);
      setTimeout(() => el.remove(), 540);
    }
  }
}

export function drawMatchTrails(groups) {
  const svg = document.getElementById('match-trail-svg');
  if (!svg || !groups || groups.length === 0) return;
  const svgRect = svg.getBoundingClientRect();
  if (svgRect.width === 0) return;
  svg.setAttribute('viewBox', `0 0 ${svgRect.width} ${svgRect.height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  for (const group of groups) {
    const positions = group.positions || group;
    if (!positions || positions.length < 2) continue;
    const def = group.type != null ? CANDY_DEFS[group.type] : null;
    const color = (def && def.color) || '#FFD60A';
    const pts = positions
      .map((p) => {
        const tile = document.querySelector(
          `#board .tile[data-c="${p.c}"][data-r="${p.r}"]`
        );
        if (!tile) return null;
        const r = tile.getBoundingClientRect();
        return `${(r.left - svgRect.left + r.width / 2).toFixed(1)},${(r.top - svgRect.top + r.height / 2).toFixed(1)}`;
      })
      .filter(Boolean);
    if (pts.length < 2) continue;
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', pts.join(' '));
    poly.setAttribute('stroke', color);
    poly.setAttribute('stroke-width', '12');
    poly.setAttribute('stroke-linecap', 'round');
    poly.setAttribute('stroke-linejoin', 'round');
    poly.setAttribute('fill', 'none');
    poly.setAttribute('class', 'match-trail');
    svg.appendChild(poly);
  }
  setTimeout(() => {
    if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
  }, 700);
}

const CONFETTI_COLORS = [
  '#FFD60A', '#0353A4', '#FF006E', '#FB5607', '#06A77D', '#8338EC',
];

export function spawnConfetti(count = 28) {
  const root = layer();
  const board = document.getElementById('board');
  if (!root || !board) return;
  const rect = board.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'particle particle-confetti';
    el.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    el.style.left = `${rect.left + Math.random() * rect.width}px`;
    el.style.top = `${rect.top + Math.random() * rect.height * 0.3}px`;
    el.style.setProperty('--drift', `${(Math.random() - 0.5) * 240}px`);
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`);
    el.style.animationDelay = `${Math.random() * 220}ms`;
    root.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
}
