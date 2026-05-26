// End-to-end integration test for the bus-driven run lifecycle.
//
// Simulates a complete roguelike slot from match → cascade → infinite
// → slot complete, emitting the same event sequence main.js produces.
// Asserts that `state.runHighlights` ends up with the correct
// aggregated values — i.e. the migrated bus subscribers wire together
// the way the old inline branches did.
//
// Run with: node --test tests/integration-run-flow.test.js
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
    slotMutator: null,
    runHighlights: {
      maxCascade: 0,
      biggestMatch: 0,
      totalMatches: 0,
      bestSlotScore: 0,
      infiniteCount: 0,
      mutatorsSeen: [],
    },
  };
  unsub = registerRunEffects(state);
});

test('a full simulated slot accumulates the right run-highlights', () => {
  // Slot starts with a mutator.
  state.slotMutator = 'golden-hour';
  bus.emit('slot:start', { slot: 5, isBoss: false, mechanic: null });
  assert.deepEqual(state.runHighlights.mutatorsSeen, ['golden-hour']);

  // Player swaps. Match of 3 fires at cascade level 1.
  bus.emit('match', { cascadeLevel: 1, matchSize: 3 });
  // Cascades chain twice — each is a fresh `match` event at higher level.
  bus.emit('match', { cascadeLevel: 2, matchSize: 4 });
  bus.emit('match', { cascadeLevel: 3, matchSize: 5 });

  // After this one chain:
  //   totalMatches = 1 (only the cascade-1 round counts)
  //   maxCascade   = 3
  //   biggestMatch = 5
  assert.equal(state.runHighlights.totalMatches, 1);
  assert.equal(state.runHighlights.maxCascade, 3);
  assert.equal(state.runHighlights.biggestMatch, 5);

  // Second swap — another single match, no chain.
  bus.emit('match', { cascadeLevel: 1, matchSize: 4 });
  assert.equal(state.runHighlights.totalMatches, 2);
  assert.equal(state.runHighlights.maxCascade, 3); // not bumped down
  assert.equal(state.runHighlights.biggestMatch, 5); // not bumped down

  // Player hits a 1M-score infinite mid-slot.
  bus.emit('infinite', { nth_this_session: 1, score: 1_000_001, slot: 5 });
  assert.equal(state.runHighlights.infiniteCount, 1);

  // Slot complete — highest score on this slot was 1.5M.
  bus.emit('slot:complete', { slot: 5, isBoss: false, score: 1_500_000, movesUsed: 18 });
  assert.equal(state.runHighlights.bestSlotScore, 1_500_000);
});

test('handlers are wired so a 100-slot run never accumulates >32 mutators', () => {
  // Simulate the player crossing 32 mutator slots — the array should cap.
  for (let i = 0; i < 40; i++) {
    state.slotMutator = `mutator-${i}`;
    bus.emit('slot:start', { slot: i * 5, isBoss: false });
  }
  assert.equal(state.runHighlights.mutatorsSeen.length, 32);
});

test("non-roguelike runs don't pollute runHighlights", () => {
  state.inRoguelikeRun = false;
  bus.emit('match', { cascadeLevel: 5, matchSize: 9 });
  bus.emit('infinite', { nth_this_session: 1, score: 2_000_000, slot: 99 });
  bus.emit('slot:complete', { slot: 99, isBoss: true, score: 999_999, movesUsed: 1 });
  assert.equal(state.runHighlights.maxCascade, 0);
  assert.equal(state.runHighlights.biggestMatch, 0);
  assert.equal(state.runHighlights.infiniteCount, 0);
  assert.equal(state.runHighlights.bestSlotScore, 0);
});

test('unsub removes every handler in one call', () => {
  unsub();
  bus.emit('match', { cascadeLevel: 9, matchSize: 9 });
  bus.emit('infinite', { nth_this_session: 1, score: 1e9, slot: 1 });
  bus.emit('slot:complete', { slot: 1, score: 1e9 });
  assert.deepEqual(state.runHighlights, {
    maxCascade: 0, biggestMatch: 0, totalMatches: 0,
    bestSlotScore: 0, infiniteCount: 0, mutatorsSeen: [],
  });
});
