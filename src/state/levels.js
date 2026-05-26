// Levels store — slice for the Levels mode. Owns:
//   - levelProgress: stars per level + best scores (persistent)
//   - level: the active level definition (ephemeral)
//   - movesRemaining: counter for the active level (ephemeral)
//
// The active board itself stays on the shared `state.board` for
// now — every mode renders to the same DOM grid and the rendering
// pipeline reads from a single place. A future PR can decide
// whether to slice the board too.

export function createLevelsStore(state) {
  return {
    // ---- Active level (ephemeral) ----
    activeLevel: () => state.level || null,
    setActiveLevel: (lvl) => { state.level = lvl; },
    clearActiveLevel: () => { state.level = null; },

    movesRemaining: () => state.movesRemaining || 0,
    setMovesRemaining: (n) => { state.movesRemaining = n; },

    // ---- Progression (persistent) ----
    currentLevelId: () => state.levelProgress?.currentLevel || 1,
    setCurrentLevelId: (id) => {
      if (!state.levelProgress) state.levelProgress = {};
      state.levelProgress.currentLevel = id;
    },

    starsFor: (id) => (state.levelProgress?.stars || {})[id] || 0,
    setStarsFor: (id, n) => {
      if (!state.levelProgress) state.levelProgress = {};
      if (!state.levelProgress.stars) state.levelProgress.stars = {};
      // Only raise — best stars are sticky.
      state.levelProgress.stars[id] = Math.max(
        state.levelProgress.stars[id] || 0,
        n,
      );
    },

    bestScoreFor: (id) => (state.levelProgress?.bestScores || {})[id] || 0,
    setBestScoreFor: (id, score) => {
      if (!state.levelProgress) state.levelProgress = {};
      if (!state.levelProgress.bestScores) state.levelProgress.bestScores = {};
      state.levelProgress.bestScores[id] = Math.max(
        state.levelProgress.bestScores[id] || 0,
        score,
      );
    },
  };
}
