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
    hasMutator = () => false,
    upgradeCount = () => 0,
    setLuckyCharge = () => {},
    flashMessage = () => {},
    persist = () => {},
    spawnCrazyTile = () => {},
    powerupBank = () => ({}),
    setPowerupCounts = () => {},
    effectivePowerupCap = () => Infinity,
    fireLightning = () => {},
    preservingReshuffle = () => {},
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

  // 🧁 Confectionery relic. Was inline in processMatchRound under
  // `if (specialsCreated.length > 0)`. For each special born this
  // round, picks a random power-up kind from the standard pool and
  // bumps the bank by 1 (capped per kind via effectivePowerupCap).
  // Round-scoped flashMessage with the total count.
  unsubs.push(bus.on('match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    const n = ctx && ctx.specialsCreated ? ctx.specialsCreated.length : 0;
    if (n === 0) return;
    if (!hasRelic('confectionery')) return;
    const bank = powerupBank() || {};
    const pool = ['hammer', 'shuffle', 'colorBomb', 'plusMoves'];
    for (let i = 0; i < n; i++) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if ((bank[pick] || 0) < effectivePowerupCap(pick)) bank[pick] = (bank[pick] || 0) + 1;
    }
    setPowerupCounts(bank);
    flashMessage(`🧁 Confectionery! +${n} 🎁`, 1000);
  }));

  // 👛 Coin Purse relic. Was inline in processMatchRound's
  // `cascadeLevel === 1` block. Every 10 matches in a slot earns +1
  // gem with a flash + persist. Subscribes to the new `roguelike:match`
  // event so it can read the post-increment slotMatchCount from the
  // payload (the canonical `match` event fires before the increment).
  unsubs.push(bus.on('roguelike:match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || typeof ctx.slotMatchCount !== 'number') return;
    if (ctx.slotMatchCount % 10 !== 0) return;
    if (!hasRelic('coin-purse')) return;
    if (!state.roguelike) return;
    state.roguelike.gems = (state.roguelike.gems || 0) + 1;
    flashMessage('👛 Coin Purse +1 💎', 900);
    persist();
  }));

  // ⛏ Diamond Mine mutator. Was inline in processMatchRound's
  // `cascadeLevel === 1` block. Every 6 matches in a slot earns +1
  // gem. Same shape as Coin Purse, different cadence + holder type.
  unsubs.push(bus.on('roguelike:match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || typeof ctx.slotMatchCount !== 'number') return;
    if (ctx.slotMatchCount % 6 !== 0) return;
    if (!hasMutator('diamond-mine')) return;
    if (!state.roguelike) return;
    state.roguelike.gems = (state.roguelike.gems || 0) + 1;
    flashMessage('⛏ Diamond Mine +1 💎', 800);
    persist();
  }));

  // 🪅 Piñata relic. Was inline in processMatchRound's
  // `cascadeLevel === 1` block. Every 5 matches drops one random
  // power-up (capped per-kind).
  unsubs.push(bus.on('roguelike:match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || typeof ctx.slotMatchCount !== 'number') return;
    if (ctx.slotMatchCount % 5 !== 0) return;
    if (!hasRelic('pinata')) return;
    const bank = powerupBank() || {};
    const pool = ['hammer', 'shuffle', 'colorBomb', 'plusMoves'];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if ((bank[pick] || 0) < effectivePowerupCap(pick)) {
      bank[pick] = (bank[pick] || 0) + 1;
      setPowerupCounts(bank);
      flashMessage(`🪅 Piñata! +1 ${pick}`, 1000);
    }
  }));

  // 👜 Pixie Pouch relic. Was inline in processMatchRound's
  // `cascadeLevel === 1` block. Every 18 matches grant +1 of EVERY
  // power-up kind (each respecting its cap).
  unsubs.push(bus.on('roguelike:match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || typeof ctx.slotMatchCount !== 'number') return;
    if (ctx.slotMatchCount % 18 !== 0) return;
    if (!hasRelic('pixie-pouch')) return;
    const bank = powerupBank() || {};
    for (const key of ['hammer', 'shuffle', 'colorBomb', 'plusMoves']) {
      bank[key] = Math.min(effectivePowerupCap(key), (bank[key] || 0) + 1);
    }
    setPowerupCounts(bank);
    flashMessage('👜 Pixie Pouch! +1 of each', 1200);
  }));

  // 🍨 Sundae Saturday relic. Was inline in processMatchRound's
  // `cascadeLevel === 1` block. Every 8 matches grant +1 plusMoves
  // power-up (respecting its cap).
  unsubs.push(bus.on('roguelike:match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || typeof ctx.slotMatchCount !== 'number') return;
    if (ctx.slotMatchCount % 8 !== 0) return;
    if (!hasRelic('sundae-saturday')) return;
    const bank = powerupBank() || {};
    if ((bank.plusMoves || 0) < effectivePowerupCap('plusMoves')) {
      bank.plusMoves = (bank.plusMoves || 0) + 1;
      setPowerupCounts(bank);
      flashMessage('🍨 Sundae Saturday! +1 +3 Moves', 1000);
    }
  }));

  // 🌶 Spice Box relic. Was inline in processMatchRound's
  // `cascadeLevel === 1` block. Every 12 matches spawn a random
  // crazy tile (no kind arg → random pick).
  unsubs.push(bus.on('roguelike:match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || typeof ctx.slotMatchCount !== 'number') return;
    if (ctx.slotMatchCount % 12 !== 0) return;
    if (!hasRelic('spice-box')) return;
    spawnCrazyTile();
    flashMessage('🌶 Spice Box!', 900);
  }));

  // 💥 Sugar Crash relic. Was inline in processMatchRound's
  // `cascadeLevel === 1` block. Every 14 matches spawn a TNT.
  unsubs.push(bus.on('roguelike:match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || typeof ctx.slotMatchCount !== 'number') return;
    if (ctx.slotMatchCount % 14 !== 0) return;
    if (!hasRelic('sugar-crash')) return;
    spawnCrazyTile('tnt');
    flashMessage('💥 Sugar Crash!', 900);
  }));

  // ✨ Spark Strike upgrade. Was inline in processMatchRound's
  // `cascadeLevel === 1` block. Every 12 matches fires a free
  // Lightning effect (via the fireLightning helper).
  unsubs.push(bus.on('roguelike:match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || typeof ctx.slotMatchCount !== 'number') return;
    if (ctx.slotMatchCount % 12 !== 0) return;
    if (upgradeCount('spark-strike') <= 0) return;
    flashMessage('✨ Spark Strike!', 900);
    fireLightning();
  }));

  // 🌀 Whirlpool relic. Was inline in processMatchRound's
  // `cascadeLevel === 1` block. Every 10 matches reshuffle the board
  // in place. Delayed 280ms via setTimeout so the player sees the
  // current match resolve first.
  unsubs.push(bus.on('roguelike:match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || typeof ctx.slotMatchCount !== 'number') return;
    if (ctx.slotMatchCount % 10 !== 0) return;
    if (!hasRelic('whirlpool')) return;
    flashMessage('🌀 Whirlpool reshuffle!', 1100);
    setTimeout(() => { if (state.board) preservingReshuffle(); }, 280);
  }));

  // 🪞 Cracked Mirror relic. Was inline in processMatchRound's
  // `cascadeLevel === 1` block. Big-match (5+) score on cascade 1
  // fills Lucky bar +20%, clamped at 100, marks ready when crossed.
  // Reads matchSize from the event payload.
  unsubs.push(bus.on('roguelike:match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || typeof ctx.matchSize !== 'number') return;
    if (ctx.matchSize < 5) return;
    if (!hasRelic('cracked-mirror')) return;
    state.luckyCharge = Math.min(100, (state.luckyCharge || 0) + 20);
    if (state.luckyCharge >= 100) state.luckyReady = true;
    setLuckyCharge(state.luckyCharge, state.luckyReady);
  }));

  // 🪙 Coin Toss mutator. Was inline in processMatchRound's
  // `cascadeLevel === 1` block. 25% chance per match (not gated on
  // slotMatchCount) to grant +1 random power-up. Two RNG draws:
  // one for the trigger, one for the kind.
  unsubs.push(bus.on('roguelike:match', () => {
    if (!state.inRoguelikeRun) return;
    if (!hasMutator('coin-toss')) return;
    if (Math.random() >= 0.25) return;
    const bank = powerupBank() || {};
    const pool = ['hammer', 'shuffle', 'colorBomb', 'plusMoves'];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if ((bank[pick] || 0) < effectivePowerupCap(pick)) {
      bank[pick] = (bank[pick] || 0) + 1;
      setPowerupCounts(bank);
      flashMessage(`🪙 Coin Toss! +1 ${pick}`, 800);
    }
  }));

  // 🐞 Lucky Ladybug relic. Was inline in processMatchRound's
  // `cascadeLevel === 1` block. Every 11 matches drops a random
  // power-up (cap-respecting). Same shape as Piñata, different
  // cadence + flash.
  unsubs.push(bus.on('roguelike:match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || typeof ctx.slotMatchCount !== 'number') return;
    if (ctx.slotMatchCount % 11 !== 0) return;
    if (!hasRelic('ladybug')) return;
    const bank = powerupBank() || {};
    const pool = ['hammer', 'shuffle', 'colorBomb', 'plusMoves'];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if ((bank[pick] || 0) < effectivePowerupCap(pick)) {
      bank[pick] = (bank[pick] || 0) + 1;
      setPowerupCounts(bank);
      flashMessage(`🐞 Ladybug! +1 ${pick}`, 1000);
    }
  }));

  // 🍵 Bottomless Cup mutator. Was inline in processMatchRound under
  // the `cascadeLevel === 1` block. +20% Lucky bar per match (gated to
  // cascade level 1 so chains don't tick the bar more than once per
  // swap). Clamps at 100 and marks ready.
  unsubs.push(bus.on('match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || ctx.cascadeLevel !== 1) return;
    if (!hasMutator('bottomless-cup')) return;
    state.luckyCharge = Math.min(100, (state.luckyCharge || 0) + 20);
    if (state.luckyCharge >= 100) state.luckyReady = true;
    setLuckyCharge(state.luckyCharge, state.luckyReady);
  }));

  // 🍀 Lucky Magnet upgrade. Was inline in processMatchRound under
  // the `cascadeLevel === 1` block. 5% chance per stack to instantly
  // fill the Lucky bar; on success, flashes a confirmation message.
  unsubs.push(bus.on('match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    if (!ctx || ctx.cascadeLevel !== 1) return;
    const stacks = upgradeCount('lucky-magnet');
    if (stacks <= 0) return;
    const chance = 0.05 * stacks;
    if (Math.random() >= chance) return;
    state.luckyCharge = 100;
    state.luckyReady = true;
    setLuckyCharge(state.luckyCharge, state.luckyReady);
    flashMessage('🍀 Lucky Magnet! Bar full!', 1000);
  }));

  // 🛰 Echo Drone relic. Was inline in processMatchRound after the
  // specials block. +10% Lucky bar per special spawned this round.
  // No flash, no marking ready beyond the natural clamp — matches the
  // pre-migration behavior exactly. Round-scoped, so subscribes to
  // `match` and reads ctx.specialsCreated.length.
  unsubs.push(bus.on('match', (ctx) => {
    if (!state.inRoguelikeRun) return;
    const n = ctx && ctx.specialsCreated ? ctx.specialsCreated.length : 0;
    if (n === 0) return;
    if (!hasRelic('echo-drone')) return;
    state.luckyCharge = Math.min(100, (state.luckyCharge || 0) + 10 * n);
    setLuckyCharge(state.luckyCharge, state.luckyReady);
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
