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

test('roguelike currentSlot clamped to [1, 9999] (endless mode preserves slot > 100)', () => {
  globalThis.localStorage.clear();
  // Endless mode: a player at slot 150 must NOT have their currentSlot
  // silently clamped to 100 on next reload.
  save.save({ settings: {}, levelProgress: {}, roguelike: { currentSlot: 150 }, runUpgrades: [], runRelics: [] });
  const data = save.load();
  assert.equal(data.roguelike.currentSlot, 150);
});

test('roguelike currentSlot defensive max at 9999', () => {
  globalThis.localStorage.clear();
  save.save({ settings: {}, levelProgress: {}, roguelike: { currentSlot: 1_000_000 }, runUpgrades: [], runRelics: [] });
  const data = save.load();
  assert.equal(data.roguelike.currentSlot, 9999);
});

test('classStats bestSlot preserves endless-mode highs', () => {
  globalThis.localStorage.clear();
  save.save({
    settings: {},
    levelProgress: {},
    roguelike: { classStats: { champion: { runs: 5, completes: 1, bestSlot: 220 } } },
    runUpgrades: [],
    runRelics: [],
  });
  const data = save.load();
  assert.equal(data.roguelike.classStats.champion.bestSlot, 220);
});

test('runHistory slot preserves endless-mode highs', () => {
  globalThis.localStorage.clear();
  save.save({
    settings: {},
    levelProgress: {},
    roguelike: {},
    runUpgrades: [],
    runRelics: [],
    runHistory: [{ ts: 1, outcome: 'fail', slot: 175, class: 'champion', gems: 50, score: 99999, daily: false, dailyStamp: null }],
  });
  const data = save.load();
  assert.equal(data.runHistory[0].slot, 175);
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

test('getSaveStatus reports the last save outcome', () => {
  globalThis.localStorage.clear();
  save.save({ settings: {}, levelProgress: {}, roguelike: {}, runUpgrades: [], runRelics: [] });
  const status = save.getSaveStatus();
  assert.equal(status.ok, true);
  assert.equal(status.error, null);
});

test('getSaveStatus surfaces a QuotaExceededError', () => {
  globalThis.localStorage.clear();
  // Stub setItem to throw on next call.
  const real = globalThis.localStorage.setItem.bind(globalThis.localStorage);
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  try {
    save.save({ settings: {}, levelProgress: {}, roguelike: {}, runUpgrades: [], runRelics: [] });
    const status = save.getSaveStatus();
    assert.equal(status.ok, false);
    assert.match(status.error, /Quota/);
  } finally {
    globalThis.localStorage.setItem = real;
  }
});

test('resetProgress preserves settings but wipes everything else', () => {
  globalThis.localStorage.clear();
  // Seed a "played a lot" save.
  save.save({
    highScore: 99999,
    streak: 14,
    settings: { sound: false, size: 'large', mode: 'roguelike' },
    levelProgress: { currentLevel: 50, stars: {}, bestScores: {}, powerupBank: {} },
    roguelike: { currentSlot: 80, gems: 500, runsCompleted: 5 },
    inRoguelikeRun: true,
    runUpgrades: ['snowball'],
    runRelics: ['stardust'],
  });
  const current = save.load();
  const fresh = save.resetProgress(current);
  // Settings preserved
  assert.equal(fresh.settings.sound, false);
  assert.equal(fresh.settings.size, 'large');
  // Everything else reset
  assert.equal(fresh.highScore, 0);
  assert.equal(fresh.streak, 0);
  assert.equal(fresh.inRoguelikeRun, false);
  assert.equal(fresh.roguelike.currentSlot, 1);
  assert.equal(fresh.roguelike.gems, 0);
});

test('resetProgress with no current state still produces fresh defaults', () => {
  globalThis.localStorage.clear();
  const fresh = save.resetProgress(null);
  assert.equal(fresh.highScore, 0);
  assert.ok(fresh.settings, 'settings present');
});

test('bumpStreakForToday: same-day call is a no-op', () => {
  const today = new Date().toISOString().slice(0, 10);
  const before = { lastPlayedDate: today, streak: 5 };
  const after = save.bumpStreakForToday(before);
  // Same-day: returns the original object unchanged.
  assert.equal(after, before);
});

test('bumpStreakForToday: yesterday increments the streak', () => {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const before = { lastPlayedDate: yesterday, streak: 5 };
  const after = save.bumpStreakForToday(before);
  assert.equal(after.streak, 6);
  assert.equal(after.lastPlayedDate, today.toISOString().slice(0, 10));
});

test('bumpStreakForToday: gap >1 day resets streak to 1', () => {
  const before = { lastPlayedDate: '2020-01-01', streak: 99 };
  const after = save.bumpStreakForToday(before);
  assert.equal(after.streak, 1);
});

test('bumpStreakForToday: missing lastPlayedDate starts streak at 1', () => {
  const after = save.bumpStreakForToday({ streak: 0 });
  assert.equal(after.streak, 1);
});
