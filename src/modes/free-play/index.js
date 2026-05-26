// Free Play mode — endless casual gameplay, no level objective, no
// run state. Simplest mode in the game; serves as the canonical
// example of the per-mode module pattern.
//
// Modules in src/modes/<id>/ declare their dependencies up-front
// via register(deps). They have no implicit reach into main.js
// globals — the runtime (src/modes/index.js) and the mode-specific
// helpers are passed in. This keeps each mode:
//   - testable in isolation (mock the deps)
//   - movable between projects without rewiring imports
//   - explicit about its surface area (read register's deps list
//     to see exactly what this mode touches)
//
// register() returns the mode's public API ({ start }) so main.js
// can keep its existing internal callers (e.g. restart button)
// without ceremony.

import { registerMode } from '../index.js';

export function register(deps) {
  const {
    state,
    cancelHint,
    hideLevelOverlay,
    resetBoard,
    refreshLevelUI,
    renderBoard,
    scheduleHint,
  } = deps;

  function start() {
    cancelHint();
    hideLevelOverlay();
    state.level = null;
    resetBoard();
    state.movesRemaining = 0;
    refreshLevelUI();
    renderBoard(state.board, state, { intro: true });
    scheduleHint();
  }

  function exit() {
    // Cancel any in-flight cascade so a Free Play match that's still
    // animating can't keep mutating state after the player switches
    // modes.
    state.cascadeAbort = true;
  }

  registerMode({
    id: 'free',
    enter() { start(); },
    exit,
  });

  return { start };
}
