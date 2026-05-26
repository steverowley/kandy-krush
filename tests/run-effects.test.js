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

// --- 🚶 Moves bundle (slot:start → +N moves from upgrades / relics / mutators) ---

test("moves+2 upgrade adds 2 moves per stack", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, movesRemaining: 10 };
  registerRunEffects(s, { upgradeCount: (id) => (id === 'moves+2' ? 3 : 0) });
  bus.emit('slot:start', { slot: 5 });
  // 3 stacks × +2 = +6 moves.
  assert.equal(s.movesRemaining, 16);
});

test("mover+3 upgrade adds 3 moves per stack", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, movesRemaining: 10 };
  registerRunEffects(s, { upgradeCount: (id) => (id === 'mover+3' ? 2 : 0) });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.movesRemaining, 16);
});

test("Slow Turtle relic adds 5 moves at slot start", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, movesRemaining: 10 };
  registerRunEffects(s, { hasRelic: (id) => id === 'slow-turtle' });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.movesRemaining, 15);
});

test("Quick Slot mutator adds 5 moves at slot start", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, movesRemaining: 10 };
  registerRunEffects(s, { hasMutator: (id) => id === 'quick-slot' });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.movesRemaining, 15);
});

test("Long Lunch mutator adds 10 moves at slot start", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, movesRemaining: 10 };
  registerRunEffects(s, { hasMutator: (id) => id === 'long-lunch' });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.movesRemaining, 20);
});

test("Moves bundle stacks across sources additively", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, movesRemaining: 10 };
  registerRunEffects(s, {
    upgradeCount: (id) => (id === 'moves+2' ? 1 : id === 'mover+3' ? 1 : 0),
    hasRelic: (id) => id === 'slow-turtle',
    hasMutator: (id) => id === 'quick-slot' || id === 'long-lunch',
  });
  bus.emit('slot:start', { slot: 5 });
  // +2 + +3 + +5 + +5 + +10 = +25.
  assert.equal(s.movesRemaining, 35);
});

test("Moves bundle is a no-op when nothing applies", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, movesRemaining: 10 };
  registerRunEffects(s, {});
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.movesRemaining, 10);
});

// --- 💝 Surprise Life mutator (slot:start → +1 life + flash + UI refresh) ---

test("Surprise Life bumps livesRemaining on slot start", () => {
  bus.clear();
  let uiCalls = 0;
  const s = { inRoguelikeRun: true, roguelike: { livesRemaining: 3 } };
  registerRunEffects(s, {
    hasMutator: (id) => id === 'surprise-life',
    refreshLevelUI: () => uiCalls++,
  });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.roguelike.livesRemaining, 4);
  assert.equal(uiCalls, 1);
});

test("Surprise Life no-op without the mutator", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: { livesRemaining: 3 } };
  registerRunEffects(s, { hasMutator: () => false });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.roguelike.livesRemaining, 3);
});

// --- 🎰 Bonus Round mutator (slot:start → +10 gems + persist) ---

test("Bonus Round grants +10 gems on slot start with persist", () => {
  bus.clear();
  let persistCalls = 0;
  const s = { inRoguelikeRun: true, roguelike: { gems: 5 } };
  registerRunEffects(s, {
    hasMutator: (id) => id === 'bonus-round',
    persist: () => persistCalls++,
  });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.roguelike.gems, 15);
  assert.equal(persistCalls, 1);
});

// --- 💵 Big Money mutator (slot:start → +10 gems, no persist) ---

test("Big Money grants +10 gems on slot start WITHOUT persist", () => {
  bus.clear();
  let persistCalls = 0;
  const s = { inRoguelikeRun: true, roguelike: { gems: 5 } };
  registerRunEffects(s, {
    hasMutator: (id) => id === 'big-money',
    persist: () => persistCalls++,
  });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.roguelike.gems, 15);
  // Persist is intentionally NOT called — the original inline branch
  // didn't persist either; the surrounding slot-start flow handles
  // saving before the player can swap.
  assert.equal(persistCalls, 0);
});

// --- 🍀 Lucky Day mutator (slot:start → fills Lucky bar to 100) ---

test("Lucky Day fills Lucky bar at slot start", () => {
  bus.clear();
  const calls = [];
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  registerRunEffects(s, {
    hasMutator: (id) => id === 'lucky-day',
    setLuckyCharge: (c, r) => calls.push({ c, r }),
  });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.luckyCharge, 100);
  assert.equal(s.luckyReady, true);
  assert.deepEqual(calls, [{ c: 100, r: true }]);
});

// --- 🎁 Gift Slot mutator (slot:start → +1 of each power-up) ---

test("Gift Slot grants +1 of each power-up at slot start", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { hammer: 0, shuffle: 0, colorBomb: 0, plusMoves: 0 };
  registerRunEffects(s, {
    hasMutator: (id) => id === 'gift-slot',
    powerupBank: () => bank,
    setPowerupCounts: () => {},
    effectivePowerupCap: () => 99,
  });
  bus.emit('slot:start', { slot: 5 });
  assert.deepEqual(bank, { hammer: 1, shuffle: 1, colorBomb: 1, plusMoves: 1 });
});

test("Gift Slot respects per-kind caps", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { hammer: 5, shuffle: 0, colorBomb: 0, plusMoves: 0 };
  registerRunEffects(s, {
    hasMutator: () => true,
    powerupBank: () => bank,
    effectivePowerupCap: (k) => (k === 'hammer' ? 5 : 99),
  });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(bank.hammer, 5); // cap
  assert.equal(bank.shuffle, 1);
});

// --- 🔨🌧 Hammer Storm mutator (slot:start → +3 hammers) ---

test("Hammer Storm grants +3 hammers at slot start", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { hammer: 1 };
  registerRunEffects(s, {
    hasMutator: (id) => id === 'hammer-storm',
    powerupBank: () => bank,
    setPowerupCounts: () => {},
    effectivePowerupCap: () => 99,
  });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(bank.hammer, 4);
});

// --- 💣💣 Bomb Cache mutator (slot:start → +2 color bombs) ---

test("Bomb Cache grants +2 color bombs at slot start", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { colorBomb: 1 };
  registerRunEffects(s, {
    hasMutator: (id) => id === 'bomb-cache',
    powerupBank: () => bank,
    setPowerupCounts: () => {},
    effectivePowerupCap: () => 99,
  });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(bank.colorBomb, 3);
});

// --- 🌬 Second Wind relic (slot:start at 1 life → +1 life) ---

test("Second Wind bumps lives to 2 if at 1", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: { livesRemaining: 1 } };
  registerRunEffects(s, { hasRelic: (id) => id === 'second-wind' });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.roguelike.livesRemaining, 2);
});

test("Second Wind is a no-op at 2+ lives", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: { livesRemaining: 2 } };
  registerRunEffects(s, { hasRelic: () => true });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.roguelike.livesRemaining, 2); // unchanged
});

test("Second Wind is a no-op at 0 lives (you've already lost)", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: { livesRemaining: 0 } };
  registerRunEffects(s, { hasRelic: () => true });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(s.roguelike.livesRemaining, 0); // doesn't revive
});

// --- ✏️ Eraser mutator (slot:start → queue a meteor on deferredSlotFx) ---

test("Eraser queues a meteor onto state.deferredSlotFx at slot start", () => {
  bus.clear();
  let meteorCalls = 0;
  const s = {
    inRoguelikeRun: true,
    deferredSlotFx: [],
    board: { rows: 8, cols: 8 },
  };
  registerRunEffects(s, {
    hasMutator: (id) => id === 'eraser',
    fireMeteor: () => meteorCalls++,
  });
  bus.emit('slot:start', { slot: 5 });
  // One callback queued — meteor hasn't fired yet.
  assert.equal(s.deferredSlotFx.length, 1);
  assert.equal(meteorCalls, 0);
  // Player closes intro → deferredSlotFx is drained → meteor fires.
  for (const fx of s.deferredSlotFx) fx();
  assert.equal(meteorCalls, 1);
});

test("Eraser meteor is gated on state.board being present", () => {
  bus.clear();
  let meteorCalls = 0;
  const s = { inRoguelikeRun: true, deferredSlotFx: [], board: null };
  registerRunEffects(s, {
    hasMutator: () => true,
    fireMeteor: () => meteorCalls++,
  });
  bus.emit('slot:start', { slot: 5 });
  for (const fx of s.deferredSlotFx) fx();
  assert.equal(meteorCalls, 0);
});

test("Eraser is a no-op if deferredSlotFx is missing", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, board: { rows: 8, cols: 8 } };
  registerRunEffects(s, { hasMutator: () => true });
  // Should not throw.
  bus.emit('slot:start', { slot: 5 });
});

// --- 🗝 Lockpick mutator (slot:start → weaken every lock by 1 level) ---

test("Lockpick decrements every lock by 1; locks at level 1 disappear", () => {
  bus.clear();
  const lockMap = new Map([['3,4', 1], ['5,6', 2], ['7,8', 3]]);
  let renderCalls = 0;
  const s = { inRoguelikeRun: true, lockMap, board: { rows: 8, cols: 8 } };
  registerRunEffects(s, {
    hasMutator: (id) => id === 'lockpick',
    renderBoard: () => renderCalls++,
  });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(lockMap.has('3,4'), false); // level 1 → removed
  assert.equal(lockMap.get('5,6'), 1); // level 2 → 1
  assert.equal(lockMap.get('7,8'), 2); // level 3 → 2
  assert.equal(renderCalls, 1);
});

test("Lockpick is a no-op with an empty lockMap", () => {
  bus.clear();
  let renderCalls = 0;
  const s = { inRoguelikeRun: true, lockMap: new Map(), board: { rows: 8, cols: 8 } };
  registerRunEffects(s, {
    hasMutator: () => true,
    renderBoard: () => renderCalls++,
  });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(renderCalls, 0); // no work, no re-render
});

test("Lockpick is a no-op without the mutator", () => {
  bus.clear();
  const lockMap = new Map([['3,4', 2]]);
  const s = { inRoguelikeRun: true, lockMap, board: { rows: 8, cols: 8 } };
  registerRunEffects(s, { hasMutator: () => false });
  bus.emit('slot:start', { slot: 5 });
  assert.equal(lockMap.get('3,4'), 2); // unchanged
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

// --- 💰 Treasure Slot mutator (slot:complete → +5 gems, +10 with meta) ---

test("Treasure Slot grants +5 gems on slot complete", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: { gems: 0 }, runHighlights: { bestSlotScore: 0 } };
  registerRunEffects(s, { hasMutator: (id) => id === 'treasure' });
  bus.emit('slot:complete', { slot: 5, isBoss: false, score: 1000, movesUsed: 10 });
  assert.equal(s.roguelike.gems, 5);
});

test("Treasure Slot grants +10 gems with treasure-sense meta", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: { gems: 0 }, runHighlights: { bestSlotScore: 0 } };
  registerRunEffects(s, {
    hasMutator: (id) => id === 'treasure',
    hasMeta: (id) => id === 'treasure-sense',
  });
  bus.emit('slot:complete', { slot: 5, isBoss: false, score: 1000, movesUsed: 10 });
  assert.equal(s.roguelike.gems, 10);
});

test("Treasure Slot is a no-op without the mutator", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: { gems: 0 }, runHighlights: { bestSlotScore: 0 } };
  registerRunEffects(s, { hasMutator: () => false });
  bus.emit('slot:complete', { slot: 5, isBoss: false, score: 1000, movesUsed: 10 });
  assert.equal(s.roguelike.gems, 0);
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

// --- 👛 Coin Purse relic (roguelike:match every 10th → +1 gem) ---

test("Coin Purse fires every 10th roguelike match", () => {
  bus.clear();
  let persistCalls = 0;
  const s = { inRoguelikeRun: true, roguelike: { gems: 0 } };
  registerRunEffects(s, {
    hasRelic: (id) => id === 'coin-purse',
    persist: () => persistCalls++,
  });
  // Matches 1–9: no fire.
  for (let i = 1; i <= 9; i++) {
    bus.emit('roguelike:match', { slotMatchCount: i, cascadeLevel: 1, matchSize: 3 });
  }
  assert.equal(s.roguelike.gems, 0);
  assert.equal(persistCalls, 0);
  // Match 10: fires.
  bus.emit('roguelike:match', { slotMatchCount: 10, cascadeLevel: 1, matchSize: 3 });
  assert.equal(s.roguelike.gems, 1);
  assert.equal(persistCalls, 1);
  // Match 20: fires again.
  bus.emit('roguelike:match', { slotMatchCount: 20, cascadeLevel: 1, matchSize: 3 });
  assert.equal(s.roguelike.gems, 2);
  assert.equal(persistCalls, 2);
});

test("Coin Purse no-op without the relic", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: { gems: 0 } };
  registerRunEffects(s, { hasRelic: () => false });
  bus.emit('roguelike:match', { slotMatchCount: 10, cascadeLevel: 1, matchSize: 3 });
  assert.equal(s.roguelike.gems, 0);
});

// --- ⛏ Diamond Mine mutator (roguelike:match every 6th → +1 gem) ---

test("Diamond Mine fires every 6th roguelike match", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: { gems: 0 } };
  registerRunEffects(s, { hasMutator: (id) => id === 'diamond-mine' });
  bus.emit('roguelike:match', { slotMatchCount: 5, cascadeLevel: 1, matchSize: 3 });
  assert.equal(s.roguelike.gems, 0);
  bus.emit('roguelike:match', { slotMatchCount: 6, cascadeLevel: 1, matchSize: 3 });
  assert.equal(s.roguelike.gems, 1);
  bus.emit('roguelike:match', { slotMatchCount: 12, cascadeLevel: 1, matchSize: 3 });
  assert.equal(s.roguelike.gems, 2);
  bus.emit('roguelike:match', { slotMatchCount: 13, cascadeLevel: 1, matchSize: 3 });
  assert.equal(s.roguelike.gems, 2); // no fire
});

// --- 🪅 Piñata relic (roguelike:match every 5th → +1 random power-up) ---

test("Piñata drops one random power-up every 5th match (respects cap)", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { hammer: 0 };
  let setCalls = 0;
  const realRandom = Math.random;
  Math.random = () => 0; // always picks 'hammer'
  try {
    registerRunEffects(s, {
      hasRelic: (id) => id === 'pinata',
      powerupBank: () => bank,
      setPowerupCounts: () => setCalls++,
      effectivePowerupCap: () => 99,
    });
    bus.emit('roguelike:match', { slotMatchCount: 4, cascadeLevel: 1, matchSize: 3 });
    assert.equal(bank.hammer, 0);
    bus.emit('roguelike:match', { slotMatchCount: 5, cascadeLevel: 1, matchSize: 3 });
    assert.equal(bank.hammer, 1);
    assert.equal(setCalls, 1);
    bus.emit('roguelike:match', { slotMatchCount: 10, cascadeLevel: 1, matchSize: 3 });
    assert.equal(bank.hammer, 2);
  } finally {
    Math.random = realRandom;
  }
});

test("Piñata respects the per-kind cap", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { hammer: 5 };
  const realRandom = Math.random;
  Math.random = () => 0;
  try {
    registerRunEffects(s, {
      hasRelic: (id) => id === 'pinata',
      powerupBank: () => bank,
      effectivePowerupCap: (k) => (k === 'hammer' ? 5 : 99),
    });
    bus.emit('roguelike:match', { slotMatchCount: 5, cascadeLevel: 1, matchSize: 3 });
    assert.equal(bank.hammer, 5); // already at cap, no bump
  } finally {
    Math.random = realRandom;
  }
});

// --- 👜 Pixie Pouch relic (roguelike:match every 18th → +1 each power-up) ---

test("Pixie Pouch grants +1 of every power-up every 18th match", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { hammer: 0, shuffle: 0, colorBomb: 0, plusMoves: 0 };
  registerRunEffects(s, {
    hasRelic: (id) => id === 'pixie-pouch',
    powerupBank: () => bank,
    setPowerupCounts: () => {},
    effectivePowerupCap: () => 99,
  });
  bus.emit('roguelike:match', { slotMatchCount: 17, cascadeLevel: 1, matchSize: 3 });
  assert.deepEqual(bank, { hammer: 0, shuffle: 0, colorBomb: 0, plusMoves: 0 });
  bus.emit('roguelike:match', { slotMatchCount: 18, cascadeLevel: 1, matchSize: 3 });
  assert.deepEqual(bank, { hammer: 1, shuffle: 1, colorBomb: 1, plusMoves: 1 });
});

test("Pixie Pouch honors caps per-kind", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { hammer: 5, shuffle: 0, colorBomb: 0, plusMoves: 0 };
  registerRunEffects(s, {
    hasRelic: () => true,
    powerupBank: () => bank,
    setPowerupCounts: () => {},
    effectivePowerupCap: (k) => (k === 'hammer' ? 5 : 99),
  });
  bus.emit('roguelike:match', { slotMatchCount: 18, cascadeLevel: 1, matchSize: 3 });
  // Hammer at cap stays at 5; others +1.
  assert.deepEqual(bank, { hammer: 5, shuffle: 1, colorBomb: 1, plusMoves: 1 });
});

// --- 🍨 Sundae Saturday relic (roguelike:match every 8th → +1 plusMoves) ---

test("Sundae Saturday grants +1 plusMoves every 8th match", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { plusMoves: 0 };
  registerRunEffects(s, {
    hasRelic: (id) => id === 'sundae-saturday',
    powerupBank: () => bank,
    setPowerupCounts: () => {},
    effectivePowerupCap: () => 99,
  });
  bus.emit('roguelike:match', { slotMatchCount: 7, cascadeLevel: 1, matchSize: 3 });
  assert.equal(bank.plusMoves, 0);
  bus.emit('roguelike:match', { slotMatchCount: 8, cascadeLevel: 1, matchSize: 3 });
  assert.equal(bank.plusMoves, 1);
  bus.emit('roguelike:match', { slotMatchCount: 16, cascadeLevel: 1, matchSize: 3 });
  assert.equal(bank.plusMoves, 2);
});

test("Sundae Saturday respects plusMoves cap", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { plusMoves: 3 };
  registerRunEffects(s, {
    hasRelic: () => true,
    powerupBank: () => bank,
    effectivePowerupCap: (k) => (k === 'plusMoves' ? 3 : 99),
  });
  bus.emit('roguelike:match', { slotMatchCount: 8, cascadeLevel: 1, matchSize: 3 });
  assert.equal(bank.plusMoves, 3); // capped
});

// --- 🌶 Spice Box relic (roguelike:match every 12th → random crazy tile) ---

test("Spice Box spawns a random crazy tile every 12th match", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  registerRunEffects(s, {
    hasRelic: (id) => id === 'spice-box',
    spawnCrazyTile: (kind) => spawned.push(kind ?? 'random'),
  });
  bus.emit('roguelike:match', { slotMatchCount: 11, cascadeLevel: 1, matchSize: 3 });
  assert.deepEqual(spawned, []);
  bus.emit('roguelike:match', { slotMatchCount: 12, cascadeLevel: 1, matchSize: 3 });
  assert.deepEqual(spawned, ['random']);
  bus.emit('roguelike:match', { slotMatchCount: 24, cascadeLevel: 1, matchSize: 3 });
  assert.deepEqual(spawned, ['random', 'random']);
});

// --- 💥 Sugar Crash relic (roguelike:match every 14th → TNT) ---

test("Sugar Crash spawns a TNT every 14th match", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  registerRunEffects(s, {
    hasRelic: (id) => id === 'sugar-crash',
    spawnCrazyTile: (kind) => spawned.push(kind),
  });
  bus.emit('roguelike:match', { slotMatchCount: 13, cascadeLevel: 1, matchSize: 3 });
  assert.deepEqual(spawned, []);
  bus.emit('roguelike:match', { slotMatchCount: 14, cascadeLevel: 1, matchSize: 3 });
  assert.deepEqual(spawned, ['tnt']);
});

// --- ✨ Spark Strike upgrade (roguelike:match every 12th → free Lightning) ---

test("Spark Strike fires a Lightning every 12th match when held", () => {
  bus.clear();
  let lightningCalls = 0;
  const s = { inRoguelikeRun: true };
  registerRunEffects(s, {
    upgradeCount: (id) => (id === 'spark-strike' ? 1 : 0),
    fireLightning: () => lightningCalls++,
  });
  bus.emit('roguelike:match', { slotMatchCount: 11, cascadeLevel: 1, matchSize: 3 });
  assert.equal(lightningCalls, 0);
  bus.emit('roguelike:match', { slotMatchCount: 12, cascadeLevel: 1, matchSize: 3 });
  assert.equal(lightningCalls, 1);
  bus.emit('roguelike:match', { slotMatchCount: 24, cascadeLevel: 1, matchSize: 3 });
  assert.equal(lightningCalls, 2);
});

test("Spark Strike no-op without the upgrade", () => {
  bus.clear();
  let lightningCalls = 0;
  const s = { inRoguelikeRun: true };
  registerRunEffects(s, {
    upgradeCount: () => 0,
    fireLightning: () => lightningCalls++,
  });
  bus.emit('roguelike:match', { slotMatchCount: 12, cascadeLevel: 1, matchSize: 3 });
  assert.equal(lightningCalls, 0);
});

// --- 🪞 Cracked Mirror relic (roguelike:match, matchSize ≥ 5 → +20% Lucky) ---

test("Cracked Mirror fills Lucky bar +20% on 5+ matches at cascade 1", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  registerRunEffects(s, { hasRelic: (id) => id === 'cracked-mirror' });
  bus.emit('roguelike:match', { slotMatchCount: 1, cascadeLevel: 1, matchSize: 4 });
  assert.equal(s.luckyCharge, 0); // < 5 size = no fire
  bus.emit('roguelike:match', { slotMatchCount: 2, cascadeLevel: 1, matchSize: 5 });
  assert.equal(s.luckyCharge, 20);
  bus.emit('roguelike:match', { slotMatchCount: 3, cascadeLevel: 1, matchSize: 9 });
  assert.equal(s.luckyCharge, 40);
});

test("Cracked Mirror marks luckyReady when crossing 100", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 90, luckyReady: false };
  registerRunEffects(s, { hasRelic: () => true });
  bus.emit('roguelike:match', { slotMatchCount: 1, cascadeLevel: 1, matchSize: 5 });
  assert.equal(s.luckyCharge, 100);
  assert.equal(s.luckyReady, true);
});

// --- 🪙 Coin Toss mutator (roguelike:match, 25% chance → random power-up) ---

test("Coin Toss fires on a passing 25% roll", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { hammer: 0 };
  const realRandom = Math.random;
  // First call (gate): 0.10 < 0.25, fires.
  // Second call (pick): 0 → pool[0] = 'hammer'.
  const rng = [0.10, 0];
  Math.random = () => rng.shift() ?? 0;
  try {
    registerRunEffects(s, {
      hasMutator: (id) => id === 'coin-toss',
      powerupBank: () => bank,
      setPowerupCounts: () => {},
      effectivePowerupCap: () => 99,
    });
    bus.emit('roguelike:match', { slotMatchCount: 1, cascadeLevel: 1, matchSize: 3 });
    assert.equal(bank.hammer, 1);
  } finally {
    Math.random = realRandom;
  }
});

test("Coin Toss no-op on failing roll", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { hammer: 0 };
  const realRandom = Math.random;
  Math.random = () => 0.99; // > 0.25
  try {
    registerRunEffects(s, {
      hasMutator: () => true,
      powerupBank: () => bank,
      effectivePowerupCap: () => 99,
    });
    bus.emit('roguelike:match', { slotMatchCount: 1, cascadeLevel: 1, matchSize: 3 });
    assert.equal(bank.hammer, 0);
  } finally {
    Math.random = realRandom;
  }
});

// --- 🐞 Lucky Ladybug relic (roguelike:match every 11th → random power-up) ---

test("Ladybug drops one random power-up every 11th match", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { hammer: 0 };
  const realRandom = Math.random;
  Math.random = () => 0;
  try {
    registerRunEffects(s, {
      hasRelic: (id) => id === 'ladybug',
      powerupBank: () => bank,
      setPowerupCounts: () => {},
      effectivePowerupCap: () => 99,
    });
    bus.emit('roguelike:match', { slotMatchCount: 10, cascadeLevel: 1, matchSize: 3 });
    assert.equal(bank.hammer, 0);
    bus.emit('roguelike:match', { slotMatchCount: 11, cascadeLevel: 1, matchSize: 3 });
    assert.equal(bank.hammer, 1);
    bus.emit('roguelike:match', { slotMatchCount: 22, cascadeLevel: 1, matchSize: 3 });
    assert.equal(bank.hammer, 2);
  } finally {
    Math.random = realRandom;
  }
});

// --- 🌀 Whirlpool relic (roguelike:match every 10th → board reshuffle after 280ms) ---

test("Whirlpool schedules a reshuffle every 10th match", async () => {
  bus.clear();
  let reshuffles = 0;
  const s = { inRoguelikeRun: true, board: { rows: 8, cols: 8 } };
  registerRunEffects(s, {
    hasRelic: (id) => id === 'whirlpool',
    preservingReshuffle: () => reshuffles++,
  });
  bus.emit('roguelike:match', { slotMatchCount: 10, cascadeLevel: 1, matchSize: 3 });
  // setTimeout delays — wait for it.
  await new Promise((r) => setTimeout(r, 320));
  assert.equal(reshuffles, 1);
});

test("Whirlpool reshuffle is gated on state.board being present", async () => {
  bus.clear();
  let reshuffles = 0;
  const s = { inRoguelikeRun: true, board: null }; // no board → no call
  registerRunEffects(s, {
    hasRelic: () => true,
    preservingReshuffle: () => reshuffles++,
  });
  bus.emit('roguelike:match', { slotMatchCount: 10, cascadeLevel: 1, matchSize: 3 });
  await new Promise((r) => setTimeout(r, 320));
  assert.equal(reshuffles, 0);
});

// --- 🍰 Sugar Rush relic (roguelike:match #3 → "spent" flash) ---

test("Sugar Rush flashes 'spent' exactly on the 3rd match of a slot", () => {
  bus.clear();
  const calls = [];
  const s = { inRoguelikeRun: true };
  registerRunEffects(s, {
    hasRelic: (id) => id === 'sugar-rush',
    flashMessage: (msg) => calls.push(msg),
  });
  for (let i = 1; i <= 5; i++) {
    bus.emit('roguelike:match', { slotMatchCount: i, cascadeLevel: 1, matchSize: 3 });
  }
  const sugarFlashes = calls.filter((c) => /Sugar Rush/.test(c));
  // Only fires on match 3 — not 4 or 5.
  assert.equal(sugarFlashes.length, 1);
});

// --- 💣 Crazy Magnet upgrade (roguelike:match every 3rd → N random crazy tiles) ---

test("Crazy Magnet spawns one crazy tile per stack every 3rd match", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  registerRunEffects(s, {
    upgradeCount: (id) => (id === 'crazy-magnet' ? 2 : 0),
    spawnCrazyTile: (kind) => spawned.push(kind),
    pickCrazyKind: () => 'wormhole',
  });
  bus.emit('roguelike:match', { slotMatchCount: 1, cascadeLevel: 1, matchSize: 3 });
  bus.emit('roguelike:match', { slotMatchCount: 2, cascadeLevel: 1, matchSize: 3 });
  assert.deepEqual(spawned, []);
  bus.emit('roguelike:match', { slotMatchCount: 3, cascadeLevel: 1, matchSize: 3 });
  // 2 stacks → 2 wormhole spawns on slot match 3.
  assert.deepEqual(spawned, ['wormhole', 'wormhole']);
  bus.emit('roguelike:match', { slotMatchCount: 6, cascadeLevel: 1, matchSize: 3 });
  assert.deepEqual(spawned, ['wormhole', 'wormhole', 'wormhole', 'wormhole']);
});

test("Crazy Magnet no-op without stacks", () => {
  bus.clear();
  const spawned = [];
  const s = { inRoguelikeRun: true };
  registerRunEffects(s, {
    upgradeCount: () => 0,
    spawnCrazyTile: (k) => spawned.push(k),
  });
  bus.emit('roguelike:match', { slotMatchCount: 3, cascadeLevel: 1, matchSize: 3 });
  assert.deepEqual(spawned, []);
});

test("Both Coin Purse + Diamond Mine can stack on the same match", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, roguelike: { gems: 0 } };
  registerRunEffects(s, {
    hasRelic: (id) => id === 'coin-purse',
    hasMutator: (id) => id === 'diamond-mine',
  });
  // LCM(6, 10) = 30 → both fire at slot match 30.
  bus.emit('roguelike:match', { slotMatchCount: 30, cascadeLevel: 1, matchSize: 3 });
  assert.equal(s.roguelike.gems, 2);
});

// --- 🍵 Bottomless Cup mutator (cascade 1 match → +20% Lucky bar) ---

test("Bottomless Cup adds 20% Lucky on every cascade-1 match", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  registerRunEffects(s, { hasMutator: (id) => id === 'bottomless-cup' });
  bus.emit('match', { cascadeLevel: 1, matchSize: 3, specialsCreated: [] });
  assert.equal(s.luckyCharge, 20);
  bus.emit('match', { cascadeLevel: 1, matchSize: 3, specialsCreated: [] });
  assert.equal(s.luckyCharge, 40);
});

test("Bottomless Cup is a no-op on cascades (level > 1)", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  registerRunEffects(s, { hasMutator: () => true });
  bus.emit('match', { cascadeLevel: 2, matchSize: 4, specialsCreated: [] });
  assert.equal(s.luckyCharge, 0);
});

test("Bottomless Cup marks luckyReady when it crosses 100", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 90, luckyReady: false };
  registerRunEffects(s, { hasMutator: () => true });
  bus.emit('match', { cascadeLevel: 1, matchSize: 3, specialsCreated: [] });
  // 90 + 20 = 110 → clamps to 100 + marks ready.
  assert.equal(s.luckyCharge, 100);
  assert.equal(s.luckyReady, true);
});

// --- 🍀 Lucky Magnet upgrade (cascade 1 match → 5%/stack roll to fill Lucky) ---

test("Lucky Magnet fills Lucky bar on a passing roll", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  const calls = { flash: [] };
  const realRandom = Math.random;
  Math.random = () => 0.01; // < 0.05, fires
  try {
    registerRunEffects(s, {
      upgradeCount: (id) => (id === 'lucky-magnet' ? 1 : 0),
      flashMessage: (msg) => calls.flash.push(msg),
    });
    bus.emit('match', { cascadeLevel: 1, matchSize: 4, specialsCreated: [] });
    assert.equal(s.luckyCharge, 100);
    assert.equal(s.luckyReady, true);
    assert.equal(calls.flash.length, 1);
    assert.match(calls.flash[0], /Lucky Magnet/);
  } finally {
    Math.random = realRandom;
  }
});

test("Lucky Magnet chance scales with stacks", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  const realRandom = Math.random;
  Math.random = () => 0.09; // > 0.05, < 0.10 — fires only with 2+ stacks
  try {
    registerRunEffects(s, { upgradeCount: (id) => (id === 'lucky-magnet' ? 2 : 0) });
    bus.emit('match', { cascadeLevel: 1, matchSize: 3, specialsCreated: [] });
    assert.equal(s.luckyCharge, 100);
  } finally {
    Math.random = realRandom;
  }
});

test("Lucky Magnet is a no-op on failed roll", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  const realRandom = Math.random;
  Math.random = () => 0.99; // way above 0.05 cap
  try {
    registerRunEffects(s, { upgradeCount: (id) => (id === 'lucky-magnet' ? 1 : 0) });
    bus.emit('match', { cascadeLevel: 1, matchSize: 3, specialsCreated: [] });
    assert.equal(s.luckyCharge, 0);
  } finally {
    Math.random = realRandom;
  }
});

test("Lucky Magnet is a no-op on cascade levels above 1", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  const realRandom = Math.random;
  Math.random = () => 0; // always-pass roll
  try {
    registerRunEffects(s, { upgradeCount: (id) => (id === 'lucky-magnet' ? 1 : 0) });
    bus.emit('match', { cascadeLevel: 2, matchSize: 4, specialsCreated: [] });
    assert.equal(s.luckyCharge, 0);
  } finally {
    Math.random = realRandom;
  }
});

// --- 🛰 Echo Drone relic (special spawned → +10% Lucky bar per special) ---

test("Echo Drone fills Lucky bar 10% per special spawned this round", () => {
  bus.clear();
  const calls = [];
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  registerRunEffects(s, {
    hasRelic: (id) => id === 'echo-drone',
    setLuckyCharge: (c, r) => calls.push({ c, r }),
  });
  bus.emit('match', { cascadeLevel: 1, matchSize: 5, specialsCreated: [{}] });
  assert.equal(s.luckyCharge, 10);
  bus.emit('match', { cascadeLevel: 1, matchSize: 7, specialsCreated: [{}, {}, {}] });
  assert.equal(s.luckyCharge, 40);
  assert.equal(calls.length, 2);
});

test("Echo Drone clamps at 100", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 95, luckyReady: false };
  registerRunEffects(s, { hasRelic: (id) => id === 'echo-drone' });
  bus.emit('match', { cascadeLevel: 1, matchSize: 9, specialsCreated: [{}, {}, {}] });
  // 95 + 30 = 125 → clamps to 100. Note: Echo Drone does NOT set
  // luckyReady (the inline branch never did) — that's intentional.
  assert.equal(s.luckyCharge, 100);
});

test("Echo Drone is a no-op without the relic or specials", () => {
  bus.clear();
  const s = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  registerRunEffects(s, { hasRelic: () => false });
  bus.emit('match', { cascadeLevel: 1, matchSize: 5, specialsCreated: [{}] });
  assert.equal(s.luckyCharge, 0);
  // Same but with the relic, just no specials.
  const s2 = { inRoguelikeRun: true, luckyCharge: 0, luckyReady: false };
  bus.clear();
  registerRunEffects(s2, { hasRelic: () => true });
  bus.emit('match', { cascadeLevel: 1, matchSize: 3, specialsCreated: [] });
  assert.equal(s2.luckyCharge, 0);
});

// --- 🧁 Confectionery relic (special spawned → random power-up per special) ---

test("Confectionery drops one random power-up per special spawned", () => {
  bus.clear();
  const calls = { counts: [], flash: [] };
  const s = { inRoguelikeRun: true };
  let bank = { hammer: 0, shuffle: 0, colorBomb: 0, plusMoves: 0 };
  const realRandom = Math.random;
  // Force pick = pool[0] = 'hammer' every time.
  Math.random = () => 0;
  try {
    registerRunEffects(s, {
      hasRelic: (id) => id === 'confectionery',
      powerupBank: () => bank,
      setPowerupCounts: (b) => calls.counts.push({ ...b }),
      effectivePowerupCap: () => 99,
      flashMessage: (msg, ms) => calls.flash.push({ msg, ms }),
    });
    bus.emit('match', { cascadeLevel: 1, matchSize: 5, specialsCreated: [{}, {}, {}] });
    // 3 specials × hammer = +3 hammers.
    assert.equal(bank.hammer, 3);
    assert.equal(calls.counts.length, 1);
    assert.equal(calls.counts[0].hammer, 3);
    assert.equal(calls.flash.length, 1);
    assert.match(calls.flash[0].msg, /Confectionery! \+3/);
  } finally {
    Math.random = realRandom;
  }
});

test("Confectionery respects the per-kind cap", () => {
  bus.clear();
  const s = { inRoguelikeRun: true };
  let bank = { hammer: 5 };
  const realRandom = Math.random;
  Math.random = () => 0; // always picks 'hammer'
  try {
    registerRunEffects(s, {
      hasRelic: (id) => id === 'confectionery',
      powerupBank: () => bank,
      setPowerupCounts: (b) => {},
      effectivePowerupCap: (kind) => (kind === 'hammer' ? 5 : 99),
    });
    bus.emit('match', { cascadeLevel: 1, matchSize: 5, specialsCreated: [{}, {}] });
    // Bank was already at cap (5), no bump even with 2 specials.
    assert.equal(bank.hammer, 5);
  } finally {
    Math.random = realRandom;
  }
});

test("Confectionery is a no-op without the relic", () => {
  bus.clear();
  const calls = { counts: 0 };
  const s = { inRoguelikeRun: true };
  registerRunEffects(s, {
    hasRelic: () => false,
    setPowerupCounts: () => calls.counts++,
  });
  bus.emit('match', { cascadeLevel: 1, matchSize: 5, specialsCreated: [{}] });
  assert.equal(calls.counts, 0);
});

test("Confectionery is a no-op when no specials spawned", () => {
  bus.clear();
  const calls = { counts: 0 };
  const s = { inRoguelikeRun: true };
  registerRunEffects(s, {
    hasRelic: () => true,
    setPowerupCounts: () => calls.counts++,
  });
  bus.emit('match', { cascadeLevel: 1, matchSize: 3, specialsCreated: [] });
  assert.equal(calls.counts, 0);
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
