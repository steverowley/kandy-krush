// Run-effects subscribers (Phase B6 — first migration).
//
// Today most relic / upgrade / mutator effects live as `if (...)` branches
// buried inside `processMatchRound` in main.js. That function is 360 lines
// of accumulated rules, and every new effect is another branch in another
// place. Hard to read, hard to test, hard to extend.
//
// The plan (PROJECT_PLAN.md #B6) is to migrate those branches to handlers
// on the event bus — `bus.on('match', ctx => ...)`. Each effect becomes a
// small named function attached to a named event; main.js's hot loop just
// emits the events and lets the registered handlers fan out.
//
// This file is the seed. It registers the `runHighlights` tracker (the
// pure-bookkeeping accumulator that powers the run-summary stat cards):
// max cascade, biggest match, total matches across the run. Pure
// bookkeeping, no scoring side effects — a safe first thing to move out
// of the monolith so the pattern is established.
//
// Future PRs will follow this shape:
//   1. Pull an inline `if (...) { ... }` out of processMatchRound.
//   2. Wrap it in a `bus.on('match' | 'cascade' | 'slot:start' | ...,
//      ctx => { ... })` handler in this file.
//   3. Remove the inline branch.
//   4. Add a tiny test asserting the handler reads / writes the right
//      pieces of state.

import * as bus from './event-bus.js';

// Initialize all run-effect subscribers against a `state` ref so each
// handler has access to the live game state without needing to import
// the main module (which would create a cycle). Returns an `unsubscribe`
// function for tests + clean shutdown.
export function registerRunEffects(state) {
  const unsubs = [];

  // 🏅 Per-run highlight tracker. Was inline in processMatchRound; now
  // a single subscriber that updates state.runHighlights on every
  // `match` event. Exits early outside a roguelike run.
  unsubs.push(bus.on('match', (ctx) => {
    if (!state.inRoguelikeRun || !state.runHighlights) return;
    const { cascadeLevel, matchSize } = ctx;
    if (cascadeLevel > (state.runHighlights.maxCascade || 0)) {
      state.runHighlights.maxCascade = cascadeLevel;
    }
    if (matchSize > (state.runHighlights.biggestMatch || 0)) {
      state.runHighlights.biggestMatch = matchSize;
    }
    // Total matches across the run: counted at cascade level 1 only so
    // a single chain of N counts as one match event, not N.
    if (cascadeLevel === 1) {
      state.runHighlights.totalMatches = (state.runHighlights.totalMatches || 0) + 1;
    }
  }));

  return () => {
    for (const u of unsubs) u();
    unsubs.length = 0;
  };
}
