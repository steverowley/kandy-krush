// Sweet Match — score calculator tests.
// Run with: node --test tests/score.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcScore } from '../src/game/score.js';

test('3-tile match at cascade 1 = 30', () => {
  // base = 3 * 10 = 30, length bonus = max(0, 3-3)*15 = 0, total = 30 * 1
  assert.equal(calcScore([{}, {}, {}], 1), 30);
});

test('4-tile match at cascade 1 = 55 (40 base + 15 length bonus)', () => {
  assert.equal(calcScore([{}, {}, {}, {}], 1), 55);
});

test('5-tile match at cascade 1 = 80 (50 base + 30 length bonus)', () => {
  assert.equal(calcScore([{}, {}, {}, {}, {}], 1), 80);
});

test('cascade level multiplies the whole score', () => {
  // 3-tile match: 30 base, x3 cascade = 90
  assert.equal(calcScore([{}, {}, {}], 3), 90);
  // 4-tile match: 55 base, x2 cascade = 110
  assert.equal(calcScore([{}, {}, {}, {}], 2), 110);
});

test('empty match returns 0', () => {
  assert.equal(calcScore([], 1), 0);
});
