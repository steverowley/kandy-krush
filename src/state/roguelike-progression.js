// Roguelike-progression store — *persistent* state for the
// Roguelike track. Unlike `roguelike-run` (which lives only for a
// single run), this slice survives across runs and is the source
// of truth for "the player's roguelike career":
//
//   - currentSlot: where the next run will start (typically 1)
//   - currentClass: the class chosen for the active run
//   - gems: total premium currency
//   - runsStarted / runsCompleted: lifetime counters
//   - bestSlot: deepest slot ever reached
//   - livesRemaining: lives banked at the current slot
//   - classStats: per-class wins / runs counters
//
// All of the above already live under `state.roguelike` in the
// legacy storage shape. The store API just gives those fields an
// explicit surface area so per-mode modules and the upgrade flow
// can swap to selectors/mutators instead of poking the nested
// object directly.

export function createRoguelikeProgressionStore(state) {
  // Defensive: state.roguelike was always created at boot, but
  // tests sometimes pass a bare object. The selectors below all
  // tolerate a missing slice for that reason.
  const slice = () => state.roguelike || (state.roguelike = {});

  return {
    currentSlot: () => slice().currentSlot || 0,
    setCurrentSlot: (n) => { slice().currentSlot = n; },

    currentClass: () => slice().currentClass || null,
    setCurrentClass: (id) => { slice().currentClass = id; },

    gems: () => slice().gems || 0,
    addGems: (n) => { slice().gems = (slice().gems || 0) + n; },

    runsStarted: () => slice().runsStarted || 0,
    incrementRunsStarted: () => {
      slice().runsStarted = (slice().runsStarted || 0) + 1;
    },

    runsCompleted: () => slice().runsCompleted || 0,
    incrementRunsCompleted: () => {
      slice().runsCompleted = (slice().runsCompleted || 0) + 1;
    },

    bestSlot: () => slice().bestSlot || 0,
    setBestSlotIfHigher: (n) => {
      slice().bestSlot = Math.max(slice().bestSlot || 0, n);
    },

    livesRemaining: () => slice().livesRemaining || 0,
    setLivesRemaining: (n) => { slice().livesRemaining = n; },

    classStats: () => slice().classStats || {},
    setClassStats: (s) => { slice().classStats = s; },
  };
}
