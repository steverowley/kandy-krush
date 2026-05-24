// Unified board input: detects swipes for direct swaps as well as taps
// for the existing select-then-tap flow. attachInput now takes either:
//   - a single function (legacy) treated as onTap
//   - { onTap, onSwap } where onSwap is (origin, target) for swipes.
//
// A swipe is any pointer-up that moved more than SWIPE_THRESHOLD pixels
// from where it went down — we pick the dominant axis (left/right/up/
// down) and emit a swap with the orthogonal neighbor. Anything shorter
// than that is treated as a tap.
const SWIPE_THRESHOLD = 22;
const COLS = 6;
const ROWS = 6;

export function attachInput(arg) {
  const onTap = typeof arg === 'function' ? arg : arg && arg.onTap;
  const onSwap = arg && typeof arg === 'object' ? arg.onSwap : null;
  const board = document.getElementById('board');
  if (!board) return;

  let startCell = null;
  let startX = 0;
  let startY = 0;
  let pointerId = null;

  board.addEventListener('pointerdown', (e) => {
    const tile = e.target.closest && e.target.closest('.tile');
    if (!tile || !board.contains(tile)) return;
    const c = Number(tile.dataset.c);
    const r = Number(tile.dataset.r);
    if (Number.isNaN(c) || Number.isNaN(r)) return;
    startCell = { c, r };
    startX = e.clientX;
    startY = e.clientY;
    pointerId = e.pointerId;
    try { board.setPointerCapture(e.pointerId); } catch {}
  });

  const finishGesture = (e) => {
    if (!startCell || (pointerId !== null && e.pointerId !== pointerId)) return;
    const origin = startCell;
    startCell = null;
    pointerId = null;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < SWIPE_THRESHOLD) {
      if (onTap) onTap(origin);
      return;
    }
    // Swipe — pick the dominant axis and the immediate neighbor in that
    // direction. Doesn't matter where on the board the pointer ended up.
    let target;
    if (ax >= ay) {
      target = { c: origin.c + (dx > 0 ? 1 : -1), r: origin.r };
    } else {
      target = { c: origin.c, r: origin.r + (dy > 0 ? 1 : -1) };
    }
    if (target.c < 0 || target.c >= COLS || target.r < 0 || target.r >= ROWS) {
      // Swiped off-board — fall back to a tap.
      if (onTap) onTap(origin);
      return;
    }
    if (onSwap) onSwap(origin, target);
    else if (onTap) onTap(origin);
  };

  board.addEventListener('pointerup', finishGesture);
  board.addEventListener('pointercancel', () => {
    startCell = null;
    pointerId = null;
  });
}
