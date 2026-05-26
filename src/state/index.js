// State barrel — single import point for all per-mode store
// factories. Each factory takes the legacy global `state` object
// and returns a store object exposing selectors + mutators for
// that mode's slice.
//
// Usage at boot (in main.js):
//
//   import { createRoguelikeRunStore, createRoguelikeProgressionStore,
//            createLevelsStore } from './state/index.js';
//
//   const roguelikeRun = createRoguelikeRunStore(state);
//   const roguelike    = createRoguelikeProgressionStore(state);
//   const levels       = createLevelsStore(state);
//
// Then pass `roguelikeRun` / `roguelike` / `levels` into the
// per-mode register({...}) deps blocks instead of letting each
// mode poke `state.X` directly.

export { createRoguelikeRunStore } from './roguelike-run.js';
export { createRoguelikeProgressionStore } from './roguelike-progression.js';
export { createLevelsStore } from './levels.js';
