// Thin wrapper around navigator.vibrate. Silent no-op on iOS Safari
// (and anywhere else without Vibration API support) so callers can fire
// these anywhere without feature-checking. Respects body.reduce-motion.

let enabled = true;

function canVibrate() {
  if (!enabled) return false;
  if (typeof navigator === 'undefined' || !navigator.vibrate) return false;
  if (document.body && document.body.classList.contains('reduce-motion')) return false;
  return true;
}

export function setHapticsEnabled(v) {
  enabled = !!v;
}

function buzz(pattern) {
  if (!canVibrate()) return;
  try { navigator.vibrate(pattern); } catch {}
}

// One-shot tap (tile selection, button press)
export function tap() { buzz(8); }
// Successful swap commit
export function swap() { buzz(14); }
// Match — intensity 1 (3-match) to 3 (5+ match)
export function match(intensity = 1) { buzz(Math.min(50, 18 + intensity * 8)); }
// Cascade tier — scales with how deep the chain has gone
export function cascade(level) { buzz([20, 30, Math.min(120, 18 + level * 14)]); }
// Combo special detonation
export function combo() { buzz([30, 40, 60, 30, 80]); }
// Power-up consumed
export function powerup() { buzz([15, 20, 25]); }
// New special candy born (4 or 5 in a row)
export function specialBirth() { buzz([22, 28, 40]); }
// HUGE / EPIC match milestone
export function epic() { buzz([40, 50, 90, 30, 120]); }
// Level complete celebration
export function levelComplete() { buzz([60, 60, 90, 60, 150]); }
// Invalid swap or blocked action
export function invalid() { buzz([18, 30, 18]); }
// Ingredient exits
export function drop() { buzz([14, 18, 22]); }
