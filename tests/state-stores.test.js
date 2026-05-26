// State-store unit tests — verify each per-mode store correctly
// wraps the legacy state object and exposes a clean selector +
// mutator API. The stores are pure deps-injection factories so
// the tests construct each one against a bare {} state and assert
// the public API.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createRoguelikeRunStore,
  createRoguelikeProgressionStore,
  createLevelsStore,
} from '../src/state/index.js';

test('roguelikeRun.isActive reflects the underlying flag', () => {
  const state = {};
  const store = createRoguelikeRunStore(state);
  assert.equal(store.isActive(), false);
  store.setActive(true);
  assert.equal(store.isActive(), true);
  assert.equal(state.inRoguelikeRun, true);
});

test('roguelikeRun.rng round-trips', () => {
  const state = {};
  const store = createRoguelikeRunStore(state);
  const rng = () => 0.42;
  store.setRng(rng);
  assert.equal(store.rng(), rng);
});

test('roguelikeRun.upgrades defaults to empty array', () => {
  const state = {};
  const store = createRoguelikeRunStore(state);
  assert.deepEqual(store.upgrades(), []);
  store.addUpgrade('aoe');
  store.addUpgrade('bigger-bomb');
  assert.deepEqual(store.upgrades(), ['aoe', 'bigger-bomb']);
});

test('roguelikeRun.relics defaults to empty array', () => {
  const state = {};
  const store = createRoguelikeRunStore(state);
  store.addRelic('top-hat');
  assert.deepEqual(store.relics(), ['top-hat']);
});

test('roguelikeRun.freeRerolls consume + read', () => {
  const state = {};
  const store = createRoguelikeRunStore(state);
  store.setFreeRerolls(3);
  store.consumeReroll();
  assert.equal(store.freeRerolls(), 2);
  store.consumeReroll();
  store.consumeReroll();
  store.consumeReroll(); // over-consume — should stop at 0
  assert.equal(store.freeRerolls(), 0);
});

test('roguelikeRun.clearRun wipes ephemeral state but leaves progression', () => {
  const state = { roguelike: { currentSlot: 5, gems: 100 } };
  const store = createRoguelikeRunStore(state);
  store.setActive(true);
  store.setRng(() => 0.1);
  store.setDaily(true);
  store.setDailyStamp('2026-05-26');
  store.clearRun();
  assert.equal(store.isActive(), false);
  assert.equal(store.rng(), null);
  assert.equal(store.isDaily(), false);
  assert.equal(store.dailyStamp(), null);
  // Progression intact:
  assert.equal(state.roguelike.currentSlot, 5);
  assert.equal(state.roguelike.gems, 100);
});

test('roguelikeProgression.gems addition is cumulative', () => {
  const state = { roguelike: { gems: 0 } };
  const store = createRoguelikeProgressionStore(state);
  store.addGems(10);
  store.addGems(15);
  assert.equal(store.gems(), 25);
});

test('roguelikeProgression.bestSlotIfHigher only raises', () => {
  const state = { roguelike: { bestSlot: 5 } };
  const store = createRoguelikeProgressionStore(state);
  store.setBestSlotIfHigher(3); // ignored — 3 < 5
  assert.equal(store.bestSlot(), 5);
  store.setBestSlotIfHigher(7); // raised
  assert.equal(store.bestSlot(), 7);
});

test('roguelikeProgression handles missing slice gracefully', () => {
  const state = {}; // no .roguelike at all
  const store = createRoguelikeProgressionStore(state);
  assert.equal(store.gems(), 0);
  assert.equal(store.currentSlot(), 0);
  store.addGems(5);
  assert.equal(store.gems(), 5);
  // Auto-created the slice:
  assert.ok(state.roguelike);
});

test('levels.starsFor / setStarsFor only raises', () => {
  const state = {};
  const store = createLevelsStore(state);
  assert.equal(store.starsFor(1), 0);
  store.setStarsFor(1, 2);
  assert.equal(store.starsFor(1), 2);
  store.setStarsFor(1, 1); // worse run — should be ignored
  assert.equal(store.starsFor(1), 2);
  store.setStarsFor(1, 3);
  assert.equal(store.starsFor(1), 3);
});

test('levels.bestScoreFor / setBestScoreFor only raises', () => {
  const state = {};
  const store = createLevelsStore(state);
  store.setBestScoreFor(2, 1500);
  store.setBestScoreFor(2, 800); // worse run — ignored
  assert.equal(store.bestScoreFor(2), 1500);
  store.setBestScoreFor(2, 2200);
  assert.equal(store.bestScoreFor(2), 2200);
});

test('levels.activeLevel + clearActiveLevel', () => {
  const state = {};
  const store = createLevelsStore(state);
  assert.equal(store.activeLevel(), null);
  store.setActiveLevel({ id: 3, name: 'Test' });
  assert.equal(store.activeLevel().id, 3);
  store.clearActiveLevel();
  assert.equal(store.activeLevel(), null);
});

test('levels.currentLevelId defaults to 1', () => {
  const state = {};
  const store = createLevelsStore(state);
  assert.equal(store.currentLevelId(), 1);
  store.setCurrentLevelId(5);
  assert.equal(store.currentLevelId(), 5);
});
