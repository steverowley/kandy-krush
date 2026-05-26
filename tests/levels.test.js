// Levels module — pure-function tests for src/game/levels.js.
//
// The levels table itself is data (1700+ lines of declarative level
// configs), but the lookup + progress utilities at the bottom of the
// file have no test coverage despite being the path every level
// completion screen depends on.
//
// Run with: node --test tests/levels.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS,
  getLevel,
  nextLevelId,
  isLastLevel,
  progressTowardObjective,
  starsForLevel,
} from '../src/game/levels.js';

// --- getLevel: id → level config ---

test("getLevel returns the level by id", () => {
  const first = LEVELS[0];
  assert.equal(getLevel(first.id), first);
  if (LEVELS.length > 1) {
    const second = LEVELS[1];
    assert.equal(getLevel(second.id), second);
  }
});

test("getLevel falls back to LEVELS[0] for an unknown id", () => {
  assert.equal(getLevel(999999), LEVELS[0]);
  assert.equal(getLevel('not-an-id'), LEVELS[0]);
  assert.equal(getLevel(null), LEVELS[0]);
});

// --- nextLevelId: progression cursor ---

test("nextLevelId returns the next level id for non-last levels", () => {
  if (LEVELS.length < 2) return; // skip if only one level
  const first = LEVELS[0];
  const second = LEVELS[1];
  assert.equal(nextLevelId(first.id), second.id);
});

test("nextLevelId returns null for the last level", () => {
  const last = LEVELS[LEVELS.length - 1];
  assert.equal(nextLevelId(last.id), null);
});

test("nextLevelId returns null for an unknown level id", () => {
  assert.equal(nextLevelId('definitely-not-a-level'), null);
});

// --- isLastLevel: convenience wrapper ---

test("isLastLevel is true only for the last entry in LEVELS", () => {
  const last = LEVELS[LEVELS.length - 1];
  assert.equal(isLastLevel(last.id), true);
  if (LEVELS.length > 1) {
    const first = LEVELS[0];
    assert.equal(isLastLevel(first.id), false);
  }
});

test("isLastLevel is true for unknown ids (because nextLevelId is null)", () => {
  // Implementation detail: an unknown id has no "next", so it counts
  // as the last. Tests below pin this for the future.
  assert.equal(isLastLevel('definitely-not-a-level'), true);
});

// --- progressTowardObjective: every objective kind ---

test("progressTowardObjective returns zeros for a null level", () => {
  const p = progressTowardObjective(null, 100, {});
  assert.equal(p.current, 0);
  assert.equal(p.target, 0);
  assert.equal(p.done, false);
});

test("progressTowardObjective handles 'score' objectives", () => {
  const lvl = { objective: { kind: 'score', target: 5000 } };
  const at0 = progressTowardObjective(lvl, 0, { type: {}, matches: 0, specials: 0 });
  assert.deepEqual(at0, { current: 0, target: 5000, done: false });
  const at5k = progressTowardObjective(lvl, 5000, { type: {}, matches: 0, specials: 0 });
  assert.deepEqual(at5k, { current: 5000, target: 5000, done: true });
  const over = progressTowardObjective(lvl, 9000, { type: {}, matches: 0, specials: 0 });
  assert.deepEqual(over, { current: 9000, target: 5000, done: true });
});

test("progressTowardObjective handles 'clearType' objectives", () => {
  const lvl = { objective: { kind: 'clearType', target: 30, type: 2 } };
  const at0 = progressTowardObjective(lvl, 0, { type: {}, matches: 0, specials: 0 });
  assert.equal(at0.current, 0);
  assert.equal(at0.target, 30);
  assert.equal(at0.done, false);
  // Half cleared of type 2:
  const half = progressTowardObjective(lvl, 0, { type: { 2: 15 }, matches: 0, specials: 0 });
  assert.equal(half.current, 15);
  assert.equal(half.done, false);
  // Cleared the target:
  const done = progressTowardObjective(lvl, 0, { type: { 2: 30 }, matches: 0, specials: 0 });
  assert.equal(done.done, true);
  // Mismatched type doesn't count:
  const wrong = progressTowardObjective(lvl, 0, { type: { 1: 30 }, matches: 0, specials: 0 });
  assert.equal(wrong.current, 0);
  assert.equal(wrong.done, false);
});

test("progressTowardObjective handles 'matches' objectives", () => {
  const lvl = { objective: { kind: 'matches', target: 20 } };
  const at0 = progressTowardObjective(lvl, 0, { type: {}, matches: 0, specials: 0 });
  assert.deepEqual(at0, { current: 0, target: 20, done: false });
  const at20 = progressTowardObjective(lvl, 999, { type: {}, matches: 20, specials: 0 });
  assert.equal(at20.done, true);
});

test("progressTowardObjective handles 'specials' objectives", () => {
  const lvl = { objective: { kind: 'specials', target: 3 } };
  const at1 = progressTowardObjective(lvl, 0, { type: {}, matches: 0, specials: 1 });
  assert.equal(at1.current, 1);
  assert.equal(at1.done, false);
  const at3 = progressTowardObjective(lvl, 0, { type: {}, matches: 0, specials: 3 });
  assert.equal(at3.done, true);
});

test("progressTowardObjective handles 'clearJelly' objectives", () => {
  const lvl = { objective: { kind: 'clearJelly' } };
  const at0 = progressTowardObjective(lvl, 0, { jellyTotal: 12, jellyRemaining: 12 });
  assert.equal(at0.current, 0);
  assert.equal(at0.target, 12);
  assert.equal(at0.done, false);
  const half = progressTowardObjective(lvl, 0, { jellyTotal: 12, jellyRemaining: 6 });
  assert.equal(half.current, 6);
  assert.equal(half.done, false);
  const cleared = progressTowardObjective(lvl, 0, { jellyTotal: 12, jellyRemaining: 0 });
  assert.equal(cleared.current, 12);
  assert.equal(cleared.done, true);
});

test("progressTowardObjective handles 'dropIngredients' objectives", () => {
  const lvl = { objective: { kind: 'dropIngredients' } };
  const at0 = progressTowardObjective(lvl, 0, { ingredientsTotal: 3, ingredientsDropped: 0 });
  assert.equal(at0.current, 0);
  assert.equal(at0.target, 3);
  assert.equal(at0.done, false);
  const partial = progressTowardObjective(lvl, 0, { ingredientsTotal: 3, ingredientsDropped: 2 });
  assert.equal(partial.current, 2);
  assert.equal(partial.done, false);
  const done = progressTowardObjective(lvl, 0, { ingredientsTotal: 3, ingredientsDropped: 3 });
  assert.equal(done.done, true);
});

test("progressTowardObjective handles missing progress fields gracefully", () => {
  const jelly = { objective: { kind: 'clearJelly' } };
  const empty = progressTowardObjective(jelly, 0, {});
  // jellyTotal=0 should NOT be marked done — there'd be nothing to clear.
  assert.equal(empty.done, false);
  const drop = { objective: { kind: 'dropIngredients' } };
  const empty2 = progressTowardObjective(drop, 0, {});
  assert.equal(empty2.done, false);
});

// --- starsForLevel: moves-remaining → star count ---

test("starsForLevel returns 3 stars when 50%+ moves remain", () => {
  const lvl = { moves: 20 };
  assert.equal(starsForLevel(lvl, 20), 3);
  assert.equal(starsForLevel(lvl, 10), 3); // exactly 50%
  assert.equal(starsForLevel(lvl, 15), 3);
});

test("starsForLevel returns 2 stars between 25% and 50% moves", () => {
  const lvl = { moves: 20 };
  assert.equal(starsForLevel(lvl, 9), 2); // 45%
  assert.equal(starsForLevel(lvl, 5), 2); // 25%
});

test("starsForLevel returns 1 star below 25% moves remaining", () => {
  const lvl = { moves: 20 };
  assert.equal(starsForLevel(lvl, 4), 1); // 20%
  assert.equal(starsForLevel(lvl, 1), 1);
  assert.equal(starsForLevel(lvl, 0), 1);
});

test("starsForLevel returns 0 for a null level", () => {
  assert.equal(starsForLevel(null, 20), 0);
});

// --- LEVELS table sanity checks ---

test("LEVELS table is non-empty and every entry has a unique id", () => {
  assert.ok(LEVELS.length > 0);
  const ids = LEVELS.map((l) => l.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, 'duplicate ids in LEVELS');
});

test("every LEVEL has the fields the rest of the codebase reads", () => {
  for (const lvl of LEVELS) {
    assert.ok(lvl.id !== undefined, `level missing id`);
    assert.ok(typeof lvl.moves === 'number', `level ${lvl.id} missing moves`);
    assert.ok(lvl.objective && typeof lvl.objective.kind === 'string',
      `level ${lvl.id} missing objective.kind`);
  }
});
