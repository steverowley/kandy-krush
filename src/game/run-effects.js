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
// the main module (which would create a cycle).
//
// `helpers` carries the small set of side-effect functions handlers
// occasionally need (relic lookup, UI flash, lucky-bar update). Each
// defaults to a no-op so tests can register handlers against a bare
// state object without stubbing the world. main.js passes the real
// implementations.
//
// Returns an `unsubscribe` function for tests + clean shutdown.
export function registerRunEffects(state, helpers = {}) {
  const {
    hasRelic = () => false,
    upgradeCount = () => 0,
    setLuckyCharge = () => {},
    flashMessage = () => {},
    persist = () => {},
    spawnCrazyTile = () => {},
  } = helpers;
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

  // 🌪 Mutator history tracker. Was inline in
  // applyRunUpgradesOnSlotStart; now a slot:start subscriber. Pushes
  // the active mutator (set by the surrounding slot-init code BEFORE
  // bus.emit('slot:start')) onto state.runHighlights.mutatorsSeen so
  // the run-summary can show which mutators the player saw.
  unsubs.push(bus.on('slot:start', () => {
    if (!state.inRoguelikeRun || !state.runHighlights) return;
    if (!state.slotMutator) return;
    const list = state.runHighlights.mutatorsSeen;
    if (!Array.isArray(list)) return;
    if (list.length >= 32) return; // cap so a long run can't bloat the save
    list.push(state.slotMutator);
  }));

  // 🏔 Best-slot-score tracker. Was inline at the top of
  // advanceRoguelikeAfterWin; now a slot:complete subscriber. Bumps
  // state.runHighlights.bestSlotScore when the just-cleared slot's
  // score beats the previous best.
  unsubs.push(bus.on('slot:complete', (ctx) => {
    if (!state.inRoguelikeRun || !state.runHighlights) return;
    if (ctx && typeof ctx.score === 'number' && ctx.score > (state.runHighlights.bestSlotScore || 0)) {
      state.runHighlights.bestSlotScore = ctx.score;
    }
  }));

  // ♾ Infinite-combo tracker. Was inline in maybeTriggerInfiniteScore;
  // now an `infinite` event subscriber. The bus emit happens in the
  // same spot the old inline bump did, so behavior is identical.
  unsubs.push(bus.on('infinite', () => {
    if (!state.inRoguelikeRun || !state.runHighlights) return;
    state.runHighlights.infiniteCount = (state.runHighlights.infiniteCount || 0) + 1;
  }));

  // 🌟 Glow Stick relic. Was inline in processMatchRound: cascade chains
  // ≥ 6 instantly fill the Lucky bar to 100 and mark it ready. Now a
  // cascade-event subscriber. First effect to use the `helpers` channel
  // (hasRelic / setLuckyCharge / flashMessage) so the run-effects file
  // can stay clear of main.js imports and the cycle that would cause.
  unsubs.push(bus.on('cascade', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || ctx.cascadeLevel < 6) return;
    if (state.luckyMode || state.luckyReady) return;
    if (!hasRelic('glow-stick')) return;
    state.luckyCharge = 100;
    state.luckyReady = true;
    setLuckyCharge(state.luckyCharge, state.luckyReady);
    flashMessage('🌟 GLOW STICK! Lucky ready!', 1300);
  }));

  // ✨ Stardust relic. Was inline in processMatchRound under
  // `if (cascadeLevel >= 4)`. +1 gem per qualifying cascade, with a
  // flash + persist call so the gem total survives a reload.
  unsubs.push(bus.on('cascade', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || ctx.cascadeLevel < 4) return;
    if (!hasRelic('stardust')) return;
    if (!state.roguelike) return;
    state.roguelike.gems = (state.roguelike.gems || 0) + 1;
    flashMessage('✨ Stardust +1 💎', 800);
    persist();
  }));

  // 🪞 Echo Match upgrade. Was inline in processMatchRound under
  // `if (cascadeLevel >= 4)`. Fills Lucky bar by 50% per stack on every
  // qualifying cascade; clamps at 100 and marks ready when full.
  unsubs.push(bus.on('cascade', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || ctx.cascadeLevel < 4) return;
    const stacks = upgradeCount('echo-match');
    if (stacks <= 0) return;
    const add = 50 * stacks;
    state.luckyCharge = Math.min(100, (state.luckyCharge || 0) + add);
    if (state.luckyCharge >= 100) state.luckyReady = true;
    setLuckyCharge(state.luckyCharge, state.luckyReady);
    flashMessage(`🪞 Echo Match +${add}% 🍀`, 800);
  }));

  // 🌊 Cascade Splash upgrade. Was inline in processMatchRound under
  // `if (cascadeLevel >= 2)`. Each stack rolls a 60% chance to spawn a
  // random crazy tile (kind omitted → random pick by spawnCrazyTile).
  unsubs.push(bus.on('cascade', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || ctx.cascadeLevel < 2) return;
    const stacks = upgradeCount('cascade-splash');
    if (stacks <= 0) return;
    for (let i = 0; i < stacks; i++) {
      if (Math.random() < 0.6) spawnCrazyTile();
    }
  }));

  // 🔥 Furnace upgrade. Was inline in processMatchRound under
  // `if (cascadeLevel >= 3)`. Each stack deterministically spawns a TNT
  // crazy tile. No RNG gate — the upgrade rewards reaching the chain.
  unsubs.push(bus.on('cascade', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || ctx.cascadeLevel < 3) return;
    const stacks = upgradeCount('furnace');
    if (stacks <= 0) return;
    for (let i = 0; i < stacks; i++) spawnCrazyTile('tnt');
  }));

  // 💣 Bomb Maker upgrade. Was inline in processMatchRound under
  // `if (specialsCreated.length > 0)`. For each stack, rolls a chance
  // of 50% × specialsCount to spawn a TNT crazy tile — so two specials
  // in one round guarantee every stack fires. Round-scoped, so we
  // subscribe to `match` and read ctx.specialsCreated.length once.
  unsubs.push(bus.on('match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    const n = ctx && ctx.specialsCreated ? ctx.specialsCreated.length : 0;
    if (n === 0) return;
    const stacks = upgradeCount('bomb-maker');
    if (stacks <= 0) return;
    for (let i = 0; i < stacks; i++) {
      if (Math.random() < 0.5 * n) spawnCrazyTile('tnt');
    }
  }));

  // 🌈 Prism Maker upgrade. Was inline in processMatchRound under
  // `if (specialsCreated.length > 0)`. Single roll per round; chance
  // = min(0.6, 0.15 × stacks × specialsCount). Spawns a Prism crazy
  // tile on success.
  unsubs.push(bus.on('match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    const n = ctx && ctx.specialsCreated ? ctx.specialsCreated.length : 0;
    if (n === 0) return;
    const stacks = upgradeCount('prism-maker');
    if (stacks <= 0) return;
    const chance = Math.min(0.6, 0.15 * stacks * n);
    if (Math.random() < chance) spawnCrazyTile('prism');
  }));

  // 🌸 Cherry Wand relic. Was inline in processMatchRound under
  // `if (specialsCreated.length > 0)`. Fills Lucky bar by 25% per
  // special spawned this round (so a swap that births 2 specials fills
  // 50%). Subscribes to `match` rather than `special:birth` so the
  // batch fires once per round, not once per individual special — the
  // inline branch was likewise round-scoped, not per-special.
  unsubs.push(bus.on('match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    const n = ctx && ctx.specialsCreated ? ctx.specialsCreated.length : 0;
    if (n === 0) return;
    if (!hasRelic('cherry-wand')) return;
    const fill = 25 * n;
    state.luckyCharge = Math.min(100, (state.luckyCharge || 0) + fill);
    if (state.luckyCharge >= 100) state.luckyReady = true;
    setLuckyCharge(state.luckyCharge, state.luckyReady);
  }));

  return () => {
    for (const u of unsubs) u();
    unsubs.length = 0;
  };
}
