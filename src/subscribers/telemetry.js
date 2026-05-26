// 🚌 Telemetry bus subscribers — every analytics event the game
// records is now an event-bus subscription, not an inline
// telemetry.track() call scattered throughout main.js + the
// per-mode files.
//
// Why this matters:
//   1. The per-mode files (src/modes/<id>/index.js) no longer
//      need to import telemetry at all — they emit semantic
//      events ('mode:picked', 'run:class_chosen', 'daily:start')
//      and this module translates those events into analytics
//      payloads.
//   2. Adding a new analytics event is one subscriber addition
//      here, not edits across multiple call sites.
//   3. Testing the mode files no longer requires mocking
//      telemetry.
//   4. The bus is the contract; subscribers are pluggable
//      (telemetry, audio, haptics, achievements all subscribe
//      to the same event stream).
//
// register(deps) hooks all subscribers and returns an `off()`
// function that tears them all down — useful for tests and for
// a future "telemetry disabled" toggle.

export function register(deps) {
  const { bus, telemetry } = deps;
  const unsubs = [];

  // ---- Mode selection (start menu) ----
  unsubs.push(bus.on('mode:picked', (ctx) => {
    telemetry.track('mode_picked', { mode: ctx.mode });
  }));

  // ---- Roguelike run lifecycle ----
  unsubs.push(bus.on('run:class_chosen', (ctx) => {
    telemetry.track('run_start', {
      class: ctx.class,
      archetype: ctx.archetype,
      starting_upgrades: ctx.startingUpgrades,
      runs_completed_before: ctx.runsCompletedBefore,
    });
  }));

  unsubs.push(bus.on('daily:start', (ctx) => {
    telemetry.track('daily_seed_start', { stamp: ctx.stamp });
  }));

  // ---- Ascension picked from class picker ----
  unsubs.push(bus.on('ascension:picked', (ctx) => {
    telemetry.track('ascension_picked', { level: ctx.level });
  }));

  // ---- Infinite-combo fired (score crossed the threshold mid-cascade) ----
  // The bus payload carries mode + slot context so the analytics shape
  // matches the legacy inline telemetry.track('infinite_combo', ...).
  unsubs.push(bus.on('infinite', (ctx) => {
    telemetry.track('infinite_combo', {
      nth_this_session: ctx.nth_this_session,
      score: ctx.score,
      mode: ctx.mode,
      slot: ctx.slot,
    });
  }));

  return {
    off() {
      for (const u of unsubs) u();
      unsubs.length = 0;
    },
  };
}
