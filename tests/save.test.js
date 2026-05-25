// Save round-trip + corruption recovery tests.
// Run with: node --test tests/save.test.js
//
// localStorage doesn't exist in the Node runtime. We polyfill a tiny
// in-memory Storage shim and crypto.randomUUID before importing the
// module so the test runs the real load/save code path against it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = globalThis;
if (!globalThis.crypto) globalThis.crypto = {};

const save = await import('../src/storage/save.js');

test('load() on empty storage returns defaults', () => {
  globalThis.localStorage.clear();
  const data = save.load();
  assert.equal(data.highScore, 0);
  assert.equal(data.seenWelcome, false);
  assert.equal(data.inRoguelikeRun, false);
  assert.ok(data.settings);
  assert.equal(data.settings.size, 'medium');
});

test('save() + load() round-trips', () => {
  globalThis.localStorage.clear();
  save.save({
    highScore: 12345,
    streak: 3,
    seenWelcome: true,
    settings: { sound: true, music: false, contrast: false, size: 'large', mode: 'roguelike', speech: false, reduceMotion: false, enemies: true },
    levelProgress: { currentLevel: 5, stars: { 1: 3, 2: 2 }, bestScores: { 1: 1000 }, powerupBank: { hammer: 3, shuffle: 3, colorBomb: 1, plusMoves: 1 } },
    roguelike: { currentSlot: 7, gems: 50, runsCompleted: 1, runsStarted: 2, bestSlot: 12, livesRemaining: 0 },
    inRoguelikeRun: true,
    runUpgrades: ['snowball', 'combo-streak'],
    runRelics: ['quick-draw'],
  });
  const data = save.load();
  assert.equal(data.highScore, 12345);
  assert.equal(data.streak, 3);
  assert.equal(data.settings.size, 'large');
  assert.equal(data.roguelike.currentSlot, 7);
  assert.equal(data.inRoguelikeRun, true);
  assert.deepEqual(data.runUpgrades, ['snowball', 'combo-streak']);
});

test('load() on corrupt JSON returns defaults + records backup', () => {
  globalThis.localStorage.clear();
  globalThis.localStorage.setItem('sweet-match.v1', 'not-valid-json{{{');
  const data = save.load();
  assert.equal(data.highScore, 0); // defaults
  const status = save.getLoadStatus();
  assert.equal(status.ok, false);
  assert.ok(status.backedUpTo, 'expected backup key');
  // Backup key should exist
  assert.ok(globalThis.localStorage.getItem(status.backedUpTo));
});

test('sanitizer rejects out-of-range stars', () => {
  globalThis.localStorage.clear();
  save.save({
    settings: {},
    levelProgress: { stars: { 1: 99, 2: 3 }, bestScores: {}, powerupBank: {} },
    roguelike: {},
    runUpgrades: [],
    runRelics: [],
  });
  const data = save.load();
  // 99-star value is invalid, should be filtered out; 3-star value stays.
  assert.equal(data.levelProgress.stars[1], undefined);
  assert.equal(data.levelProgress.stars[2], 3);
});

test('size field rejects unknown values, falls back to medium', () => {
  globalThis.localStorage.clear();
  save.save({ settings: { size: 'enormous' }, levelProgress: {}, roguelike: {} });
  const data = save.load();
  assert.equal(data.settings.size, 'medium');
});

test('mode field rejects unknown values, falls back to levels', () => {
  globalThis.localStorage.clear();
  save.save({ settings: { mode: 'meta' }, levelProgress: {}, roguelike: {} });
  const data = save.load();
  assert.equal(data.settings.mode, 'levels');
});

test('roguelike currentSlot clamped to [1, 100]', () => {
  globalThis.localStorage.clear();
  save.save({ settings: {}, levelProgress: {}, roguelike: { currentSlot: 999 }, runUpgrades: [], runRelics: [] });
  const data = save.load();
  assert.ok(data.roguelike.currentSlot <= 100);
  assert.ok(data.roguelike.currentSlot >= 1);
});

test('runUpgrades array rejects non-strings + caps length', () => {
  globalThis.localStorage.clear();
  const big = new Array(500).fill('a');
  save.save({ settings: {}, levelProgress: {}, roguelike: {}, runUpgrades: [...big, 123, null, 'x'.repeat(100)], runRelics: [] });
  const data = save.load();
  // Cap is 200, non-strings rejected, > 64-char strings rejected.
  assert.ok(data.runUpgrades.length <= 200);
  for (const v of data.runUpgrades) {
    assert.equal(typeof v, 'string');
    assert.ok(v.length <= 64);
  }
});
