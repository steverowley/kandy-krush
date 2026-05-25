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
