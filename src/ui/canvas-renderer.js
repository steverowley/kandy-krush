// Canvas/WebGL renderer for the Sweet Match board, opt-in via ?canvas=1.
// When active, candy visuals are drawn by a Pixi.js Application that
// overlays #board. The existing DOM <button class="tile"> elements stay
// rendered as transparent hit targets so swipe / tap / keyboard input
// flow through input.js unchanged.
//
// Phase 16a scope (this file):
//   - Basic candy rendering (color + shape per CANDY_DEFS).
//   - Swap, pop, and intro-drop animations.
//   - Sprite reuse keyed by (col, row) — re-renders update existing
//     sprites in place so swap tweens aren't interrupted by board state
//     changes that happen mid-animation.
//
// Deferred to later phases:
//   - Specials (line-h, line-v, rainbow) and crazy tiles (TNT, void,
//     bolt, prism, wormhole) — they still render via the DOM SVG fallback
//     because we keep DOM tiles around as hit targets.
//   - Particle effects, screen shake, post-processing shaders.

import { CANDY_DEFS } from './render.js';

// Module state. `app` holds the Pixi Application; nulled out when the
// renderer is torn down or never initialized.
let app = null;
let textures = null;       // Map<typeIndex, PIXI.Texture>
let cellSprites = [];      // [r][c] -> PIXI.Sprite | null
let layout = null;         // { padding, cellSize, gap, cols, rows }
let host = null;           // DOM element where the canvas is mounted

// Public — main.js / render.js use this gate to decide whether to call
// the canvas pipeline or the DOM fallback. Reflects the player's *intent*
// (URL flag or persisted preference); the actual Pixi.js load is awaited
// lazily inside initCanvasRenderer, so this returns true even before the
// CDN script has finished downloading.
export function isCanvasMode() {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('canvas') === '1') return true;
  } catch { /* ignore */ }
  try {
    if (window.localStorage && window.localStorage.getItem('sweetMatchCanvas') === '1') return true;
  } catch { /* ignore */ }
  return false;
}

function awaitPixi(timeoutMs = 4000) {
  if (window.PIXI) return Promise.resolve(window.PIXI);
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const tick = () => {
      if (window.PIXI) { resolve(window.PIXI); return; }
      if (performance.now() - startedAt > timeoutMs) {
        reject(new Error('Pixi.js failed to load within ' + timeoutMs + 'ms'));
        return;
      }
      setTimeout(tick, 40);
    };
    tick();
  });
}

// Initialize the Pixi Application and mount its canvas inside the
// container next to #board. Idempotent — calling twice is a no-op.
export async function initCanvasRenderer({ boardEl, cols, rows }) {
  if (app) return;
  const PIXI = await awaitPixi();
  const parent = boardEl.parentElement;
  if (!parent) throw new Error('#board has no parent');
  host = parent;

  const rect = boardEl.getBoundingClientRect();
  const size = Math.max(rect.width, 320);
  // CSS gap-3 = 12px, p-4 = 16px. Read from a computed style so we stay
  // in lockstep with the DOM grid the player taps on.
  const cs = window.getComputedStyle(boardEl);
  const padding = parseFloat(cs.paddingLeft) || 16;
  const gap = parseFloat(cs.columnGap || cs.gap) || 12;
  const cellSize = (size - padding * 2 - gap * (cols - 1)) / cols;
  layout = { padding, gap, cellSize, cols, rows };

  app = new PIXI.Application();
  await app.init({
    width: size,
    height: size,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  const canvas = app.canvas;
  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  // The DOM tiles handle input; the canvas is purely visual.
  canvas.style.pointerEvents = 'none';
  // Match #board's rounded corners so the candy strip doesn't paint over them.
  canvas.style.borderRadius = '24px';
  canvas.style.zIndex = '5';
  parent.style.position = parent.style.position || 'relative';
  parent.appendChild(canvas);

  // Pre-build a texture per candy type so we're not rebuilding every frame.
  textures = new Map();
  for (let i = 0; i < CANDY_DEFS.length; i++) {
    textures.set(i, buildCandyTexture(PIXI, CANDY_DEFS[i], cellSize));
  }

  cellSprites = Array.from({ length: rows }, () => new Array(cols).fill(null));

  // 🟦 Body class lets CSS hide DOM tile SVGs and backgrounds so the
  // canvas isn't fighting two paints for the same square.
  document.body.classList.add('canvas-renderer');
}

function buildCandyTexture(PIXI, def, size) {
  // Each candy is pre-rendered into an offscreen 2D canvas, then handed
  // to Pixi as a Texture. We render at devicePixelRatio so retina /
  // hi-dpi screens stay crisp.
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.ceil(size * dpr);
  canvas.height = Math.ceil(size * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  drawCandyShape(ctx, def, size);
  return PIXI.Texture.from(canvas);
}

function drawCandyShape(ctx, def, size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;
  ctx.fillStyle = def.color;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = Math.max(size * 0.08, 3);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (def.shape) {
    // Design-5 ships the new tarot-suit shapes (pentacle / chalice /
    // heptagram / wand / crescent / sword) in the SVG renderer
    // (render.js). The Pixi/canvas path here still draws the legacy
    // primitives; until canvas gets its own design-5 follow-up, any
    // new shape name falls through to the default disk so the board
    // stays playable in canvas mode.
    case 'pentacle':
    case 'chalice':
    case 'heptagram':
    case 'wand':
    case 'crescent':
    case 'sword':
    case 'circle':
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    case 'square': {
      const s = size * 0.72;
      const x = cx - s / 2;
      const y = cy - s / 2;
      const rad = size * 0.08;
      if (ctx.roundRect) ctx.roundRect(x, y, s, s, rad);
      else { ctx.rect(x, y, s, s); }
      break;
    }
    case 'triangle':
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.95, cy + r * 0.7);
      ctx.lineTo(cx - r * 0.95, cy + r * 0.7);
      ctx.closePath();
      break;
    case 'hexagon': {
      const pts = [
        [cx, cy - r * 1.1],
        [cx + r * 0.95, cy - r * 0.55],
        [cx + r * 0.95, cy + r * 0.55],
        [cx, cy + r * 1.1],
        [cx - r * 0.95, cy + r * 0.55],
        [cx - r * 0.95, cy - r * 0.55],
      ];
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      break;
    }
    case 'star': {
      const spikes = 5;
      const outer = r;
      const inner = r * 0.45;
      for (let i = 0; i < spikes * 2; i++) {
        const ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? outer : inner;
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'heart': {
      ctx.moveTo(cx, cy + r * 0.75);
      ctx.bezierCurveTo(cx - r * 1.25, cy + r * 0.25, cx - r * 1.25, cy - r * 0.55, cx - r * 0.3, cy - r * 0.55);
      ctx.quadraticCurveTo(cx, cy - r * 0.3, cx + r * 0.3, cy - r * 0.55);
      ctx.bezierCurveTo(cx + r * 1.25, cy - r * 0.55, cx + r * 1.25, cy + r * 0.25, cx, cy + r * 0.75);
      ctx.closePath();
      break;
    }
  }
  ctx.fill();
  ctx.stroke();
}

function cellPosition(c, r) {
  return {
    x: layout.padding + c * (layout.cellSize + layout.gap),
    y: layout.padding + r * (layout.cellSize + layout.gap),
  };
}

// Reconcile sprites with the current board state. Creates / reuses /
// destroys sprites per cell so this is safe to call every render frame.
export function renderBoardCanvas(board, { intro = false } = {}) {
  if (!app) return;
  const PIXI = window.PIXI;
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const cell = board.cell(c, r);
      let sprite = cellSprites[r][c];
      if (!cell || cell.type == null) {
        if (sprite) {
          app.stage.removeChild(sprite);
          sprite.destroy();
          cellSprites[r][c] = null;
        }
        continue;
      }
      const tex = textures.get(cell.type);
      if (!tex) continue;
      if (!sprite) {
        sprite = new PIXI.Sprite(tex);
        sprite.width = layout.cellSize;
        sprite.height = layout.cellSize;
        sprite.anchor.set(0); // top-left
        app.stage.addChild(sprite);
        cellSprites[r][c] = sprite;
      } else if (sprite.texture !== tex) {
        sprite.texture = tex;
      }
      const pos = cellPosition(c, r);
      // Don't snap a sprite that's in the middle of a swap tween back to
      // its grid cell — let the in-flight animation finish, then the next
      // render will reconcile.
      if (!sprite._tweening) {
        sprite.x = pos.x;
        sprite.y = pos.y;
        sprite.alpha = 1;
        sprite.scale.x = sprite.scale.y = 1;
      }
      if (intro) {
        introDrop(sprite, pos, c, r, board.rows);
      }
    }
  }
}

// Stagger each sprite dropping in from above the board on level start.
// Cells in the bottom-right wait longest so the column-major sweep reads
// as a "shower" of candy from the top of the screen.
function introDrop(sprite, pos, c, r, totalRows) {
  const delayMs = c * 40 + r * 20;
  const dur = 480;
  const startY = pos.y - layout.cellSize * (totalRows + 2);
  sprite._tweening = true;
  sprite.y = startY;
  sprite.alpha = 0;
  const startAt = performance.now() + delayMs;
  const step = (now) => {
    if (now < startAt) { requestAnimationFrame(step); return; }
    const t = Math.min(1, (now - startAt) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    sprite.y = startY + (pos.y - startY) * eased;
    sprite.alpha = eased;
    if (t < 1) requestAnimationFrame(step);
    else { sprite._tweening = false; sprite.y = pos.y; sprite.alpha = 1; }
  };
  requestAnimationFrame(step);
}

export async function animateSwapCanvas(a, b) {
  if (!app) return;
  const sa = cellSprites[a.r]?.[a.c];
  const sb = cellSprites[b.r]?.[b.c];
  if (!sa || !sb) return;
  const pa = cellPosition(a.c, a.r);
  const pb = cellPosition(b.c, b.r);
  sa._tweening = sb._tweening = true;
  await tween(220, (t) => {
    sa.x = pa.x + (pb.x - pa.x) * t;
    sa.y = pa.y + (pb.y - pa.y) * t;
    sb.x = pb.x + (pa.x - pb.x) * t;
    sb.y = pb.y + (pa.y - pb.y) * t;
  });
  sa._tweening = sb._tweening = false;
  // The cell array assignment hasn't happened yet — the engine swaps
  // logical positions after the animation. Swap the sprite references
  // here so the next render reconciles to the right cells.
  cellSprites[a.r][a.c] = sb;
  cellSprites[b.r][b.c] = sa;
}

export async function animatePopCanvas(positions) {
  if (!app) return;
  const sprites = positions
    .map((p) => cellSprites[p.r]?.[p.c])
    .filter(Boolean);
  if (sprites.length === 0) return;
  await tween(240, (t) => {
    for (const s of sprites) {
      s.alpha = Math.max(0, 1 - t * 1.1);
      const sc = 1 + t * 0.35;
      s.scale.x = s.scale.y = sc;
    }
  });
  // The engine clears the board after the pop; the next renderBoardCanvas
  // call will destroy these sprites, so we just leave them invisible here.
}

function tween(durationMs, onTick) {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      onTick(eased);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
