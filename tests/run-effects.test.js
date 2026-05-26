// Run-effects subscriber tests. Verifies the bus-registered handlers
// in src/game/run-effects.js read from / write to a state ref the way
// the inline branches in processMatchRound used to.
//
// Run with: node --test tests/run-effects.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as bus from '../src/game/event-bus.js';
import { registerRunEffects } from '../src/game/run-effects.js';

let state;
let unsub;
beforeEach(() => {
  bus.clear();
  state = {
    inRoguelikeRun: true,
    runHighlights: { maxCascade: 0, biggestMatch: 0, totalMatches: 0 },
  };
  unsub = registerRunEffects(state);
});

test("highlight tracker bumps maxCascade when a deeper chain comes in", () => {
  bus.emit('match', { cascadeLevel: 3, matchSize: 4 });
  assert.equal(state.runHighlights.maxCascade, 3);
  bus.emit('match', { cascadeLevel: 5, matchSize: 4 });
  assert.equal(state.runHighlights.maxCascade, 5);
  // Lower chain doesn't overwrite a higher record.
  bus.emit('match', { cascadeLevel: 2, matchSize: 4 });
  assert.equal(state.runHighlights.maxCascade, 5);
});

test("highlight tracker bumps biggestMatch", () => {
  bus.emit('match', { cascadeLevel: 1, matchSize: 3 });
  assert.equal(state.runHighlights.biggestMatch, 3);
  bus.emit('match', { cascadeLevel: 1, matchSize: 9 });
  assert.equal(state.runHighlights.biggestMatch, 9);
  bus.emit('match', { cascadeLevel: 1, matchSize: 4 });
  assert.equal(state.runHighlights.biggestMatch, 9);
});

test("totalMatches counts cascade-level-1 events only (one per chain)", () => {
  bus.emit('match', { cascadeLevel: 1, matchSize: 3 });
  bus.emit('match', { cascadeLevel: 2, matchSize: 4 });
  bus.emit('match', { cascadeLevel: 3, matchSize: 5 });
  // One chain — totalMatches should be 1, not 3.
  assert.equal(state.runHighlights.totalMatches, 1);
  bus.emit('match', { cascadeLevel: 1, matchSize: 3 });
  assert.equal(state.runHighlights.totalMatches, 2);
});

test("handler exits early when not in a roguelike run", () => {
  state.inRoguelikeRun = false;
  bus.emit('match', { cascadeLevel: 9, matchSize: 9 });
  assert.equal(state.runHighlights.maxCascade, 0);
  assert.equal(state.runHighlights.biggestMatch, 0);
  assert.equal(state.runHighlights.totalMatches, 0);
});

test("handler tolerates missing runHighlights", () => {
  state.runHighlights = null;
  // Should not throw.
  bus.emit('match', { cascadeLevel: 3, matchSize: 4 });
});

test("returned unsubscribe removes all handlers", () => {
  bus.emit('match', { cascadeLevel: 4, matchSize: 4 });
  assert.equal(state.runHighlights.maxCascade, 4);
  unsub();
  bus.emit('match', { cascadeLevel: 9, matchSize: 9 });
  assert.equal(state.runHighlights.maxCascade, 4); // unchanged after unsub
});

// --- slot:start mutator tracker ---

test("slot:start handler appends state.slotMutator to mutatorsSeen", () => {
  state.runHighlights.mutatorsSeen = [];
  state.slotMutator = 'golden-hour';
  bus.emit('slot:start', { slot: 5 });
  assert.deepEqual(state.runHighlights.mutatorsSeen, ['golden-hour']);
  state.slotMutator = 'lucky-day';
  bus.emit('slot:start', { slot: 10 });
  assert.deepEqual(state.runHighlights.mutatorsSeen, ['golden-hour', 'lucky-day']);
});

test("slot:start handler is a no-op when slotMutator is null", () => {
  state.runHighlights.mutatorsSeen = [];
  state.slotMutator = null;
  bus.emit('slot:start', { slot: 5 });
  assert.deepEqual(state.runHighlights.mutatorsSeen, []);
});

test("slot:start handler caps mutatorsSeen at 32", () => {
  state.runHighlights.mutatorsSeen = new Array(32).fill('old');
  state.slotMutator = 'overflow';
  bus.emit('slot:start', { slot: 5 });
  assert.equal(state.runHighlights.mutatorsSeen.length, 32); // still capped
  assert.equal(state.runHighlights.mutatorsSeen[31], 'old'); // overflow rejected
});

// --- slot:complete best-score tracker ---

test("slot:complete handler bumps bestSlotScore on a higher score", () => {
  state.runHighlights.bestSlotScore = 0;
  bus.emit('slot:complete', { slot: 1, score: 1500 });
  assert.equal(state.runHighlights.bestSlotScore, 1500);
  bus.emit('slot:complete', { slot: 2, score: 800 });
  assert.equal(state.runHighlights.bestSlotScore, 1500); // not lowered
  bus.emit('slot:complete', { slot: 3, score: 5000 });
  assert.equal(state.runHighlights.bestSlotScore, 5000);
});

test("slot:complete handler is a no-op outside a roguelike run", () => {
  state.inRoguelikeRun = false;
  state.runHighlights.bestSlotScore = 0;
  bus.emit('slot:complete', { slot: 1, score: 9999 });
  assert.equal(state.runHighlights.bestSlotScore, 0);
});

// --- infinite event tracker ---

test("infinite event bumps runHighlights.infiniteCount", () => {
  state.runHighlights.infiniteCount = 0;
  bus.emit('infinite', { nth_this_session: 1, score: 1_000_001 });
  assert.equal(state.runHighlights.infiniteCount, 1);
  bus.emit('infinite', { nth_this_session: 2, score: 1_500_000 });
  assert.equal(state.runHighlights.infiniteCount, 2);
});

test("infinite handler is a no-op outside a roguelike run", () => {
  state.inRoguelikeRun = false;
  state.runHighlights.infiniteCount = 0;
  bus.emit('infinite', { nth_this_session: 1, score: 1_000_001 });
  assert.equal(state.runHighlights.infiniteCount, 0);
});

// --- 🌟 Glow Stick relic (cascade ≥6 → instant Lucky-ready) ---
//
// Glow Stick is the first relic effect to ride the helpers channel. The
// inline branch in processMatchRound used to do all four side effects;
// the subscriber now does the same, but receives hasRelic /
// setLuckyCharge / flashMessage as helper injections so it doesn't have
// to import from main.js (which would cycle).
test("Glow Stick relic fills Lucky bar on cascade ≥6 when held", () => {
  bus.clear();
  const calls = { lucky: [], flash: [] };
  const s = {
    inRoguelikeRun: true,
    luckyMode: false,
    luckyReady: false,
    luckyCharge: 0,
    runHighlights: { maxCascade: 0, biggestMatch: 0, totalMatches: 0 },
  };
  registerRunEffects(s, {
    hasRelic: (id) => id === 'glow-stick',
    setLuckyCharge: (charge, ready) => calls.lucky.push({ charge, ready }),
    flashMessage: (msg, ms) => calls.flash.push({ msg, ms }),
  });
  bus.emit('cascade', { cascadeLevel: 6, totalCleared: 7 });
  assert.equal(s.luckyCharge, 100);
  assert.equal(s.luckyReady, true);
  assert.deepEqual(calls.lucky, [{ charge: 100, ready: true }]);
  assert.equal(calls.flash.length, 1);
  assert.match(calls.flash[0].msg, /GLOW STICK/);
});

test("Glow Stick is a no-op below cascade 6", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyMode: false, luckyReady: false, luckyCharge: 0 };
  registerRunEffects(s, { hasRelic: () => true });
  bus.emit('cascade', { cascadeLevel: 5, totalCleared: 6 });
  assert.equal(s.luckyCharge, 0);
  assert.equal(s.luckyReady, false);
});

test("Glow Stick is a no-op when the relic isn't held", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyMode: false, luckyReady: false, luckyCharge: 0 };
  registerRunEffects(s, { hasRelic: () => false });
  bus.emit('cascade', { cascadeLevel: 7, totalCleared: 8 });
  assert.equal(s.luckyCharge, 0);
  assert.equal(s.luckyReady, false);
});

test("Glow Stick is a no-op while Lucky-MODE is already running", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyMode: true, luckyReady: false, luckyCharge: 30 };
  registerRunEffects(s, { hasRelic: (id) => id === 'glow-stick' });
  bus.emit('cascade', { cascadeLevel: 8, totalCleared: 9 });
  // Should not overwrite a charge in progress.
  assert.equal(s.luckyCharge, 30);
  assert.equal(s.luckyReady, false);
});

test("Glow Stick is a no-op when Lucky is already ready", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyMode: false, luckyReady: true, luckyCharge: 100 };
  registerRunEffects(s, { hasRelic: (id) => id === 'glow-stick' });
  bus.emit('cascade', { cascadeLevel: 6, totalCleared: 7 });
  // Already at 100 — handler should bail rather than re-firing the flash.
  assert.equal(s.luckyCharge, 100);
  assert.equal(s.luckyReady, true);
});

// --- ✨ Stardust relic (cascade ≥4 → +1 gem) ---

test("Stardust relic bumps gems on cascade ≥4 and persists", () => {
  bus.clear();
  let persistCalls = 0;
  const s = { inRoguelikeRun: true, roguelike: { gems: 5 } };
  registerRunEffects(s, { hasRelic: (id) => id === 'stardust', persist: () => persistCalls++ });
  bus.emit('cascade', { cascadeLevel: 4, totalCleared: 5 });
  assert.equal(s.roguelike.gems, 6);
  assert.equal(persistCalls, 1);
  bus.emit('cascade', { cascadeLevel: 7, totalCleared: 9 });
  assert.equal(s.roguelike.gems, 7);
  assert.equal(persistCalls, 2);
});

test("Stardust is a no-op below cascade 4", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: { gems: 5 } };
  registerRunEffects(s, { hasRelic: () => true });
  bus.emit('cascade', { cascadeLevel: 3, totalCleared: 4 });
  assert.equal(s.roguelike.gems, 5);
});

test("Stardust is a no-op without the relic", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: { gems: 5 } };
  registerRunEffects(s, { hasRelic: () => false });
  bus.emit('cascade', { cascadeLevel: 5, totalCleared: 6 });
  assert.equal(s.roguelike.gems, 5);
});

test("Stardust tolerates a missing roguelike subtree", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: null };
  registerRunEffects(s, { hasRelic: () => true });
  // Should not throw.
  bus.emit('cascade', { cascadeLevel: 6, totalCleared: 7 });
});

// --- 🪞 Echo Match upgrade (cascade ≥4 → fills Lucky bar 50% per stack) ---

test("Echo Match fills Lucky bar by 50% per stack on cascade ≥4", () => {
  bus.clear();
  const calls = [];
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  registerRunEffects(s, {
    upgradeCount: (id) => (id === 'echo-match' ? 1 : 0),
    setLuckyCharge: (c, r) => calls.push({ c, r }),
  });
  bus.emit('cascade', { cascadeLevel: 4, totalCleared: 5 });
  assert.equal(s.luckyCharge, 50);
  assert.equal(s.luckyReady, false);
  bus.emit('cascade', { cascadeLevel: 4, totalCleared: 5 });
  assert.equal(s.luckyCharge, 100);
  assert.equal(s.luckyReady, true);
  assert.equal(calls.length, 2);
});

test("Echo Match scales linearly per stack", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  registerRunEffects(s, {
    upgradeCount: (id) => (id === 'echo-match' ? 2 : 0),
  });
  bus.emit('cascade', { cascadeLevel: 4, totalCleared: 5 });
  assert.equal(s.luckyCharge, 100); // 50 × 2 = 100, clamped at 100
  assert.equal(s.luckyReady, true);
});

test("Echo Match is a no-op without the upgrade", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  registerRunEffects(s, { upgradeCount: () => 0 });
  bus.emit('cascade', { cascadeLevel: 6, totalCleared: 7 });
  assert.equal(s.luckyCharge, 0);
});

// --- 🌸 Cherry Wand relic (special spawned → +25% Lucky bar per special) ---

test("Cherry Wand fills Lucky bar by 25% per special on a match round", () => {
  bus.clear();
  const calls = [];
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  registerRunEffects(s, {
    hasRelic: (id) => id === 'cherry-wand',
    setLuckyCharge: (c, r) => calls.push({ c, r }),
  });
  bus.emit('match', {
    cascadeLevel: 1,
    matchSize: 5,
    specialsCreated: [{ type: 'A', kind: 'striped-h' }],
  });
  assert.equal(s.luckyCharge, 25);
  // Two specials in one round: +50%
  bus.emit('match', {
    cascadeLevel: 1,
    matchSize: 7,
    specialsCreated: [{ type: 'B', kind: 'striped-v' }, { type: 'C', kind: 'wrapped' }],
  });
  assert.equal(s.luckyCharge, 75);
  assert.equal(s.luckyReady, false);
  // Once it hits 100 it clamps and marks ready.
  bus.emit('match', {
    cascadeLevel: 1,
    matchSize: 9,
    specialsCreated: [{}, {}],
  });
  assert.equal(s.luckyCharge, 100);
  assert.equal(s.luckyReady, true);
  assert.equal(calls.length, 3);
});

test("Cherry Wand is a no-op when no specials were created", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  registerRunEffects(s, { hasRelic: () => true });
  bus.emit('match', { cascadeLevel: 1, matchSize: 3, specialsCreated: [] });
  assert.equal(s.luckyCharge, 0);
});

test("Cherry Wand is a no-op without the relic", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  registerRunEffects(s, { hasRelic: () => false });
  bus.emit('match', { cascadeLevel: 1, matchSize: 5, specialsCreated: [{}] });
  assert.equal(s.luckyCharge, 0);
});

test("Cherry Wand tolerates missing specialsCreated in ctx", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0 };
  registerRunEffects(s, { hasRelic: () => true });
  // Should not throw and should not fill.
  bus.emit('match', { cascadeLevel: 1, matchSize: 3 });
  assert.equal(s.luckyCharge, 0);
});

// --- 🔥 Furnace upgrade (cascade ≥3 → 1 TNT crazy tile per stack) ---

test("Furnace spawns 1 TNT crazy tile per stack on cascade ≥3", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  registerRunEffects(s, {
    upgradeCount: (id) => (id === 'furnace' ? 3 : 0),
    spawnCrazyTile: (kind) => spawned.push(kind),
  });
  bus.emit('cascade', { cascadeLevel: 3, totalCleared: 5 });
  assert.deepEqual(spawned, ['tnt', 'tnt', 'tnt']);
});

test("Furnace is a no-op below cascade 3", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  registerRunEffects(s, {
    // Furnace only — keep Cascade Splash silent.
    upgradeCount: (id) => (id === 'furnace' ? 1 : 0),
    spawnCrazyTile: (kind) => spawned.push(kind),
  });
  bus.emit('cascade', { cascadeLevel: 2, totalCleared: 4 });
  assert.deepEqual(spawned, []);
});

test("Furnace is a no-op outside a roguelike run", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: false };
  registerRunEffects(s, {
    upgradeCount: (id) => (id === 'furnace' ? 1 : 0),
    spawnCrazyTile: (kind) => spawned.push(kind),
  });
  bus.emit('cascade', { cascadeLevel: 5, totalCleared: 6 });
  assert.deepEqual(spawned, []);
});

// --- 🌊 Cascade Splash upgrade (cascade ≥2 → 60% per stack to spawn) ---

test("Cascade Splash rolls 60% chance per stack on cascade ≥2", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  // Stub Math.random to be deterministic: 0.5 < 0.6, so every roll fires.
  const realRandom = Math.random;
  Math.random = () => 0.5;
  try {
    registerRunEffects(s, {
      upgradeCount: (id) => (id === 'cascade-splash' ? 2 : 0),
      spawnCrazyTile: (kind) => spawned.push(kind ?? 'random'),
    });
    bus.emit('cascade', { cascadeLevel: 2, totalCleared: 3 });
    // 2 stacks × passing-roll = 2 spawns, both random kinds (no arg).
    assert.equal(spawned.length, 2);
    assert.deepEqual(spawned, ['random', 'random']);
  } finally {
    Math.random = realRandom;
  }
});

// --- 💣 Bomb Maker upgrade (special spawned → 50% × N chance per stack to spawn TNT) ---

test("Bomb Maker rolls 50% × specialsCount per stack on a match round", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  const realRandom = Math.random;
  Math.random = () => 0.3; // < 0.5, always fires
  try {
    registerRunEffects(s, {
      upgradeCount: (id) => (id === 'bomb-maker' ? 3 : 0),
      spawnCrazyTile: (kind) => spawned.push(kind),
    });
    bus.emit('match', { cascadeLevel: 1, matchSize: 5, specialsCreated: [{}] });
    assert.deepEqual(spawned, ['tnt', 'tnt', 'tnt']);
  } finally {
    Math.random = realRandom;
  }
});

test("Bomb Maker is guaranteed when 2+ specials spawn (0.5 × 2 = 1.0)", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  const realRandom = Math.random;
  Math.random = () => 0.999; // any chance < 1.0 should still gate
  try {
    registerRunEffects(s, {
      upgradeCount: (id) => (id === 'bomb-maker' ? 2 : 0),
      spawnCrazyTile: (kind) => spawned.push(kind),
    });
    bus.emit('match', { cascadeLevel: 1, matchSize: 7, specialsCreated: [{}, {}] });
    // 0.999 < 0.5 × 2 = 1.0, so both stacks fire.
    assert.deepEqual(spawned, ['tnt', 'tnt']);
  } finally {
    Math.random = realRandom;
  }
});

test("Bomb Maker is a no-op when no specials this round", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  registerRunEffects(s, {
    upgradeCount: (id) => (id === 'bomb-maker' ? 5 : 0),
    spawnCrazyTile: (kind) => spawned.push(kind),
  });
  bus.emit('match', { cascadeLevel: 1, matchSize: 3, specialsCreated: [] });
  assert.deepEqual(spawned, []);
});

// --- 🌈 Prism Maker upgrade (special spawned → single roll, capped at 60%) ---

test("Prism Maker rolls once per round with chance capped at 60%", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  const realRandom = Math.random;
  Math.random = () => 0.1; // < 0.6 cap, fires
  try {
    registerRunEffects(s, {
      // Big stacks × big special count would exceed 0.6 — verify the cap.
      upgradeCount: (id) => (id === 'prism-maker' ? 10 : 0),
      spawnCrazyTile: (kind) => spawned.push(kind),
    });
    bus.emit('match', { cascadeLevel: 1, matchSize: 9, specialsCreated: [{}, {}] });
    // Only ONE spawn per round, not per-stack — matches the inline logic.
    assert.deepEqual(spawned, ['prism']);
  } finally {
    Math.random = realRandom;
  }
});

test("Prism Maker doesn't fire when the roll fails", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  const realRandom = Math.random;
  Math.random = () => 0.99; // > 0.6 cap, fails
  try {
    registerRunEffects(s, {
      upgradeCount: (id) => (id === 'prism-maker' ? 1 : 0),
      spawnCrazyTile: (kind) => spawned.push(kind),
    });
    bus.emit('match', { cascadeLevel: 1, matchSize: 5, specialsCreated: [{}] });
    assert.deepEqual(spawned, []);
  } finally {
    Math.random = realRandom;
  }
});

test("Cascade Splash doesn't fire when the random roll fails", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  const realRandom = Math.random;
  Math.random = () => 0.95; // > 0.6, fails the gate
  try {
    registerRunEffects(s, {
      // Only Cascade Splash — keep Furnace silent for this test.
      upgradeCount: (id) => (id === 'cascade-splash' ? 1 : 0),
      spawnCrazyTile: (kind) => spawned.push(kind ?? 'random'),
    });
    bus.emit('cascade', { cascadeLevel: 3, totalCleared: 4 });
    assert.deepEqual(spawned, []);
  } finally {
    Math.random = realRandom;
  }
});
