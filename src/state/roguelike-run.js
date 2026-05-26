// Roguelike-run store — ephemeral state owned by a live Roguelike
// or Daily run (the two modes share the same run state by design,
// since only one run can be in flight at a time).
//
// This store is the explicit API surface for "everything about the
// current run." Today it wraps the legacy `state.X` fields directly
// so all 230+ existing call sites in main.js keep working without
// edits — the migration is incremental:
//
//   - New code (per-mode modules) goes through the store API
//   - Old code (in main.js) keeps using `state.X` for now
//   - A follow-up PR can move storage off `state` into the store
//     itself + a defineProperty back-compat shim
//
// The store deliberately exposes selectors (read) and mutators
// (write) as named methods instead of property access, so the
// surface area is grep-able and there's a single point to intercept
// for telemetry, undo, replay, etc. in the future.

export function createRoguelikeRunStore(state) {
  return {
    // ---- Run lifecycle flag ----
    isActive: () => !!state.inRoguelikeRun,
    setActive: (v) => { state.inRoguelikeRun = !!v; },

    // ---- Deterministic RNG for the run (daily seeds) ----
    rng: () => state.runRng,
    setRng: (r) => { state.runRng = r; },

    // ---- Daily-seed metadata ----
    isDaily: () => !!state.runIsDaily,
    setDaily: (v) => { state.runIsDaily = !!v; },
    dailyStamp: () => state.runDailyStamp,
    setDailyStamp: (s) => { state.runDailyStamp = s; },

    // ---- Drafted upgrades for the run ----
    upgrades: () => state.runUpgrades || [],
    setUpgrades: (u) => { state.runUpgrades = u; },
    addUpgrade: (id) => {
      if (!Array.isArray(state.runUpgrades)) state.runUpgrades = [];
      state.runUpgrades.push(id);
    },

    // ---- Drafted relics ----
    relics: () => state.runRelics || [],
    setRelics: (r) => { state.runRelics = r; },
    addRelic: (id) => {
      if (!Array.isArray(state.runRelics)) state.runRelics = [];
      state.runRelics.push(id);
    },

    // ---- Free reroll bank for the upgrade picker ----
    freeRerolls: () => state.runFreeRerolls || 0,
    setFreeRerolls: (n) => { state.runFreeRerolls = n; },
    consumeReroll: () => {
      if ((state.runFreeRerolls || 0) > 0) state.runFreeRerolls -= 1;
    },

    // ---- Per-run highlights (surfaced on run summary) ----
    highlights: () => state.runHighlights,
    setHighlights: (h) => { state.runHighlights = h; },

    // ---- Slot-scoped mutator currently in effect ----
    slotMutator: () => state.slotMutator,
    setSlotMutator: (m) => { state.slotMutator = m; },

    // ---- Soft-end teardown ----
    // Drops ephemeral run state but leaves persisted progression
    // (state.roguelike.currentSlot, gems, runsStarted, etc.) intact
    // so a future Resume path can pick up where the player left off.
    // The cascadeAbort flag short-circuits any in-flight cascade
    // loop the moment the player switches modes.
    clearRun: () => {
      state.inRoguelikeRun = false;
      state.runRng = null;
      state.runIsDaily = false;
      state.runDailyStamp = null;
      state.cascadeAbort = true;
    },
  };
}
