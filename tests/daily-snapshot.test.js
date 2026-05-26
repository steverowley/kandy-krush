// Modes-7 — Daily no longer clobbers Roguelike progression. These
// tests construct the daily module against fake deps (bus + the
// real state stores wrapping a plain {} state) and verify the
// snapshot/restore behavior end-to-end.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as bus from '../src/game/event-bus.js';
import * as dailyMode from '../src/modes/daily/index.js';
import {
  createRoguelikeRunStore,
  createRoguelikeProgressionStore,
} from '../src/state/index.js';
import * as runtime from '../src/modes/index.js';

function setup() {
  runtime._reset();
  bus.clear();
  const state = {
    roguelike: {
      currentSlot: 0,
      currentClass: null,
      livesRemaining: 0,
    },
  };
  const runStore = createRoguelikeRunStore(state);
  const progressionStore = createRoguelikeProgressionStore(state);

  // Track roguelike-start invocations + delivered context.
  const calls = { roguelikeStart: 0, roguelikeEndRunSoft: 0 };

  const mod = dailyMode.register({
    bus,
    dailySeed: () => 12345,
    dailySeedStamp: () => '2026-05-26',
    createRng: (seed) => () => seed % 1,
    runStore,
    progressionStore,
    roguelikeStart: () => { calls.roguelikeStart++; },
    roguelikeEndRunSoft: () => {
      calls.roguelikeEndRunSoft++;
      runStore.clearRun();
    },
  });

  return { state, runStore, progressionStore, mod, calls };
}

test('daily.start clobbers progression to slot 1 / null class for the daily run', () => {
  const { progressionStore, mod } = setup();
  // Player had progressed in Roguelike.
  progressionStore.setCurrentSlot(5);
  progressionStore.setCurrentClass('champion');
  mod.start();
  // Daily forces slot 1 + null class.
  assert.equal(progressionStore.currentSlot(), 1);
  assert.equal(progressionStore.currentClass(), null);
});

test('daily.exit restores the pre-daily Roguelike progression slot + class', () => {
  const { progressionStore, mod } = setup();
  progressionStore.setCurrentSlot(7);
  progressionStore.setCurrentClass('champion');
  progressionStore.setLivesRemaining(3);
  mod.start();
  // Daily clobbered to 1 / null
  assert.equal(progressionStore.currentSlot(), 1);
  // Now exit daily — snapshot restores
  mod.exit();
  assert.equal(progressionStore.currentSlot(), 7);
  assert.equal(progressionStore.currentClass(), 'champion');
  assert.equal(progressionStore.livesRemaining(), 3);
});

test('daily.exit restores run-store upgrades + relics + free rerolls', () => {
  const { runStore, mod } = setup();
  runStore.setUpgrades(['aoe', 'bigger-bomb']);
  runStore.setRelics(['top-hat', 'turtle']);
  runStore.setFreeRerolls(2);
  mod.start();
  // Daily cleared them
  assert.deepEqual(runStore.upgrades(), []);
  assert.deepEqual(runStore.relics(), []);
  assert.equal(runStore.freeRerolls(), 0);
  // Exit restores
  mod.exit();
  assert.deepEqual(runStore.upgrades(), ['aoe', 'bigger-bomb']);
  assert.deepEqual(runStore.relics(), ['top-hat', 'turtle']);
  assert.equal(runStore.freeRerolls(), 2);
});

test('daily.exit re-flags the run as active if it was active before daily', () => {
  const { runStore, mod } = setup();
  runStore.setActive(true);
  mod.start();
  assert.equal(runStore.isActive(), false); // daily cleared it
  mod.exit();
  assert.equal(runStore.isActive(), true);  // restored
});

test('daily.exit leaves run inactive if Roguelike was not in flight before daily', () => {
  const { runStore, mod } = setup();
  runStore.setActive(false);
  mod.start();
  mod.exit();
  assert.equal(runStore.isActive(), false);
});

test('daily.start fires the daily:start bus event with the stamp', () => {
  const { mod } = setup();
  const received = [];
  bus.on('daily:start', (ctx) => received.push(ctx));
  mod.start();
  assert.equal(received.length, 1);
  assert.equal(received[0].stamp, '2026-05-26');
});

test('daily.start delegates to roguelikeStart', () => {
  const { mod, calls } = setup();
  mod.start();
  assert.equal(calls.roguelikeStart, 1);
});

test('two consecutive daily.start/exit cycles each take a fresh snapshot', () => {
  const { progressionStore, mod } = setup();
  // First cycle from slot 7 / class champion
  progressionStore.setCurrentSlot(7);
  progressionStore.setCurrentClass('champion');
  mod.start();
  mod.exit();
  assert.equal(progressionStore.currentSlot(), 7);
  // Player progresses in roguelike to slot 10
  progressionStore.setCurrentSlot(10);
  progressionStore.setCurrentClass('alchemist');
  mod.start();
  mod.exit();
  // Restored to the NEW state, not the first one.
  assert.equal(progressionStore.currentSlot(), 10);
  assert.equal(progressionStore.currentClass(), 'alchemist');
});
