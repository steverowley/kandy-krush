// Mode runtime — single source of truth for "what game mode is
// active right now" and the lifecycle hooks each mode declares.
//
// Today every mode (Roguelike / Levels / Free Play / Daily Seed)
// shares one big state object, one body class, one music stream, and
// a tangle of inline `if (state.settings.mode === 'X')` branches.
// The result, repeatedly: bugs in one mode bleed into another
// (roguelike palette stuck on in Levels, daily flag carrying over
// into a regular Roguelike, etc.).
//
// This module is the first step toward proper mode separation. It
// gives each mode an explicit `enter(opts)` / `exit()` lifecycle and
// routes every mode switch through ONE chokepoint so the next-mode
// setup can't accidentally run before the previous-mode teardown.
//
// Modes register themselves via `registerMode()`. Today the mode
// objects live in main.js and just delegate to the existing start/
// stop functions, so this PR is plumbing only — no behavior change.
// Subsequent PRs migrate state ownership and UI lifecycle into the
// per-mode files under src/modes/.

const _registry = new Map();
let _active = null;

// A mode looks like:
//   {
//     id:    'roguelike' | 'levels' | 'free' | 'daily',
//     label: 'Roguelike Run',          // player-facing
//     enter(opts) { /* set up the mode */ },
//     exit()      { /* tear it down  */ },
//   }
// `enter` is allowed to be async (the runtime awaits it). `exit`
// should be synchronous and quick — it runs immediately when the
// player picks a different mode.
export function registerMode(mode) {
  if (!mode || typeof mode.id !== 'string') {
    throw new Error('registerMode: mode must have a string id');
  }
  if (typeof mode.enter !== 'function' || typeof mode.exit !== 'function') {
    throw new Error(`registerMode(${mode.id}): enter + exit must be functions`);
  }
  _registry.set(mode.id, mode);
}

export function getMode(id) {
  return _registry.get(id) || null;
}

export function listModes() {
  return [..._registry.values()];
}

export function getActiveMode() {
  return _active;
}

// Switch the active mode. Tears down the previous one (if any and
// different) before bringing up the new one. Throws if `id` isn't
// registered — callers must register all modes at boot.
export async function setActiveMode(id, opts) {
  const next = _registry.get(id);
  if (!next) {
    throw new Error(`setActiveMode: unknown mode "${id}"`);
  }
  // Skip the teardown when re-entering the same mode (e.g. Resume on
  // a Roguelike run already in progress); modes can interpret a
  // second enter() as "refresh".
  if (_active && _active.id !== id) {
    try { _active.exit(); }
    catch (err) {
      // Mode teardown must never block the next mode from starting.
      // Surface to console but keep going.
      // eslint-disable-next-line no-console
      console.error(`[modes] ${_active.id}.exit() threw:`, err);
    }
  }
  _active = next;
  await next.enter(opts);
}

// Test helper — reset registry + active so tests start from a clean
// slate. Not used by app code.
export function _reset() {
  _registry.clear();
  _active = null;
}
