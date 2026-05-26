// Levels mode — discrete levels with star ratings + per-level best
// scores. Each level has fixed moves, fixed objective, fixed board
// modifiers. Players unlock the next level by clearing the current
// one.
//
// Declares its dependencies explicitly via register(deps) so it has
// no implicit reach into main.js globals. The module exports
// `start(levelId, opts)` for in-file callers (next-level button,
// replay, restart, boot deep-link); the runtime path uses the same
// `start` via the registered enter() hook.

import { registerMode } from '../index.js';

export function register(deps) {
  const {
    state,
    sfx,
    speech,
    cancelHint,
    hideLevelOverlay,
    resetBoard,
    refreshLevelUI,
    renderBoard,
    scheduleHint,
    cascadePendingMatches,
    showLevelIntro,
    getLevel,
    applyLevelObstacles,
    LEVELS,
  } = deps;

  function start(levelId, { announce = true } = {}) {
    cancelHint();
    hideLevelOverlay();
    state.level = getLevel(levelId);
    resetBoard();
    applyLevelObstacles(state.level);
    state.movesRemaining = state.level.moves;
    refreshLevelUI();
    renderBoard(state.board, state, { intro: true });
    if (announce) {
      const bestStars = state.levelProgress.stars[state.level.id] || 0;
      const bestScore = (state.levelProgress.bestScores || {})[state.level.id] || 0;
      let bestPhrase = '';
      if (bestStars > 0 || bestScore > 0) {
        const parts = [];
        if (bestStars > 0) parts.push(`${bestStars} ${bestStars === 1 ? 'star' : 'stars'}`);
        if (bestScore > 0) parts.push(`${bestScore.toLocaleString()} points`);
        bestPhrase = ` Your best: ${parts.join(', ')}.`;
      }
      const tipPhrase = state.level.tip ? ` Tip: ${state.level.tip}` : '';
      speech.speak(
        `Level ${state.level.id}. ${state.level.name}. ${state.level.hint}. ${state.level.moves} moves.${bestPhrase}${tipPhrase}`
      );
      // Block input while intro is up; the intro resolves on tap or timeout.
      state.busy = true;
      const done = async () => {
        // Safety net: eat any stale matches on the freshly-loaded board.
        state.busy = true;
        try {
          await cascadePendingMatches();
        } finally {
          state.busy = false;
        }
        scheduleHint();
      };
      const p = showLevelIntro(state.level, LEVELS.length, { bestStars, bestScore });
      if (p && typeof p.then === 'function') p.then(done);
      else done();
    } else {
      cascadePendingMatches().then(() => scheduleHint());
    }
  }

  function exit() {
    // Cancel any in-flight cascade so a Levels match that's still
    // animating can't keep mutating state after the player switches
    // modes.
    state.cascadeAbort = true;
  }

  registerMode({
    id: 'levels',
    enter() { start(state.levelProgress.currentLevel || 1); },
    exit,
  });

  return { start };
}
