// toRoman() unit tests — every visible slot/card indicator in the
// UI formats through this so the output needs to be correct +
// graceful at the edges (0, negative, non-integer, out-of-range).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toRoman } from '../src/ui/render.js';

test('common arabic→roman conversions', () => {
  assert.equal(toRoman(1), 'I');
  assert.equal(toRoman(2), 'II');
  assert.equal(toRoman(3), 'III');
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(5), 'V');
  assert.equal(toRoman(9), 'IX');
  assert.equal(toRoman(10), 'X');
  assert.equal(toRoman(40), 'XL');
  assert.equal(toRoman(50), 'L');
  assert.equal(toRoman(90), 'XC');
  assert.equal(toRoman(100), 'C');
});

test('Major Arcana range (0–22) covers tarot deck spread', () => {
  assert.equal(toRoman(7), 'VII');
  assert.equal(toRoman(13), 'XIII');
  assert.equal(toRoman(15), 'XV');
  assert.equal(toRoman(22), 'XXII');
});

test('100 (one hundred) — the run length cap', () => {
  assert.equal(toRoman(100), 'C');
});

test('numbers above 100 still convert correctly', () => {
  assert.equal(toRoman(199), 'CXCIX');
  assert.equal(toRoman(500), 'D');
  assert.equal(toRoman(1000), 'M');
  assert.equal(toRoman(1999), 'MCMXCIX');
  assert.equal(toRoman(3999), 'MMMCMXCIX');
});

test('out-of-range / invalid values fall back gracefully', () => {
  // < 1: roman has no zero. Return the raw input as a string so the
  // UI degrades instead of throwing.
  assert.equal(toRoman(0), '0');
  assert.equal(toRoman(-5), '-5');
  // > 3999: standard roman tops out. Same fallback.
  assert.equal(toRoman(4000), '4000');
  // Non-finite values fall through to String(n).
  assert.equal(toRoman(NaN), 'NaN');
  assert.equal(toRoman(Infinity), 'Infinity');
});

test('non-integer inputs floor before conversion', () => {
  assert.equal(toRoman(7.9), 'VII');
  assert.equal(toRoman(13.1), 'XIII');
});
