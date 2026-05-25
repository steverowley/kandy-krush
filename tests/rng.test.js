// Daily-seed PRNG determinism tests.
// Run with: node --test tests/rng.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, dailySeed, dailySeedStamp, randInt, pickFrom, shuffleInPlace } from '../src/game/rng.js';

test('createRng with the same seed produces the same sequence', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 100; i++) {
    assert.equal(a(), b(), `divergence at i=${i}`);
  }
});

test('different seeds produce different sequences', () => {
  const a = createRng(1);
  const b = createRng(2);
  let same = 0;
  for (let i = 0; i < 20; i++) if (a() === b()) same++;
  assert.ok(same < 5, `expected mostly different values, got ${same}/20 collisions`);
});

test('rng output is in [0, 1)', () => {
  const r = createRng(123);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0, `value ${v} < 0`);
    assert.ok(v < 1, `value ${v} >= 1`);
  }
});

test('dailySeed is stable for the same UTC date', () => {
  const d = new Date(Date.UTC(2026, 4, 25));
  assert.equal(dailySeed(d), dailySeed(d));
});

test('dailySeed differs across consecutive days', () => {
  const d1 = new Date(Date.UTC(2026, 4, 25));
  const d2 = new Date(Date.UTC(2026, 4, 26));
  assert.notEqual(dailySeed(d1), dailySeed(d2));
});

test('dailySeedStamp is YYYY-MM-DD', () => {
  const d = new Date(Date.UTC(2026, 4, 25));
  assert.equal(dailySeedStamp(d), '2026-05-25');
});

test('randInt returns integers in [0, max)', () => {
  const r = createRng(7);
  for (let i = 0; i < 100; i++) {
    const n = randInt(r, 10);
    assert.ok(Number.isInteger(n));
    assert.ok(n >= 0 && n < 10);
  }
});

test('pickFrom returns array elements', () => {
  const r = createRng(99);
  const arr = ['a', 'b', 'c', 'd'];
  for (let i = 0; i < 20; i++) {
    assert.ok(arr.includes(pickFrom(r, arr)));
  }
});

test('pickFrom on empty array returns undefined', () => {
  assert.equal(pickFrom(createRng(1), []), undefined);
});

test('shuffleInPlace permutes without losing elements', () => {
  const r = createRng(123);
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];
  const orig = arr.slice().sort();
  shuffleInPlace(r, arr);
  assert.deepEqual(arr.slice().sort(), orig);
});

test('shuffleInPlace with same seed produces same order', () => {
  const arrA = [1, 2, 3, 4, 5, 6, 7, 8];
  const arrB = arrA.slice();
  shuffleInPlace(createRng(7), arrA);
  shuffleInPlace(createRng(7), arrB);
  assert.deepEqual(arrA, arrB);
});
