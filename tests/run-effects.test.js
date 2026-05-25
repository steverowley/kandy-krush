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
