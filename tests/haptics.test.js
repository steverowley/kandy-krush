// Haptics wrapper tests — src/audio/haptics.js.
//
// Tiny module, but the gates matter — if any of the conditions
// (no Vibration API / reduce-motion / disabled-by-setting) gets
// missed, players who explicitly opted out of haptics would still
// feel them.
//
// Run with: node --test tests/haptics.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Polyfill navigator + document before importing. Node 22's
// globalThis.navigator is read-only, so we redefine it via
// Object.defineProperty.
const calls = [];
Object.defineProperty(globalThis, 'navigator', {
  value: {
    vibrate(pattern) {
      calls.push(pattern);
      return true;
    },
  },
  configurable: true,
  writable: true,
});
globalThis.document = {
  body: {
    classList: {
      _classes: new Set(),
      contains(c) { return this._classes.has(c); },
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
    },
  },
};

const haptics = await import('../src/audio/haptics.js');

function resetState() {
  calls.length = 0;
  document.body.classList._classes.clear();
  haptics.setHapticsEnabled(true);
}

// --- pattern shape per haptic ---

test("tap fires a single short buzz", () => {
  resetState();
  haptics.tap();
  assert.deepEqual(calls, [8]);
});

test("swap fires a slightly longer buzz than tap", () => {
  resetState();
  haptics.swap();
  assert.deepEqual(calls, [14]);
});

test("match intensity scales 1 → 3", () => {
  resetState();
  haptics.match(1);
  haptics.match(2);
  haptics.match(3);
  // formula: min(50, 18 + intensity * 8) → 26, 34, 42
  assert.deepEqual(calls, [26, 34, 42]);
});

test("match clamps at 50ms even at intensity 99", () => {
  resetState();
  haptics.match(99);
  assert.deepEqual(calls, [50]);
});

test("cascade fires a 3-element pattern that grows with level", () => {
  resetState();
  haptics.cascade(2);
  haptics.cascade(8);
  // formula: [20, 30, min(120, 18 + level*14)]
  assert.deepEqual(calls[0], [20, 30, 46]);
  assert.deepEqual(calls[1], [20, 30, 120]); // clamped
});

test("combo / powerup / specialBirth / epic / levelComplete / invalid / drop each fire their patterns", () => {
  resetState();
  haptics.combo();
  haptics.powerup();
  haptics.specialBirth();
  haptics.epic();
  haptics.levelComplete();
  haptics.invalid();
  haptics.drop();
  assert.equal(calls.length, 7);
  // Every call is an array of positive numbers.
  for (const c of calls) {
    assert.ok(Array.isArray(c), 'each call should be an array');
    for (const n of c) {
      assert.ok(typeof n === 'number' && n > 0, `bad ms value ${n}`);
    }
  }
});

// --- gates: setHapticsEnabled / reduce-motion / no-API ---

test("setHapticsEnabled(false) silences every haptic", () => {
  resetState();
  haptics.setHapticsEnabled(false);
  haptics.tap();
  haptics.match(3);
  haptics.cascade(4);
  haptics.combo();
  assert.equal(calls.length, 0);
});

test("setHapticsEnabled is reversible", () => {
  resetState();
  haptics.setHapticsEnabled(false);
  haptics.tap();
  haptics.setHapticsEnabled(true);
  haptics.tap();
  assert.deepEqual(calls, [8]);
});

test("reduce-motion class on body silences every haptic", () => {
  resetState();
  document.body.classList.add('reduce-motion');
  haptics.tap();
  haptics.match(3);
  haptics.cascade(4);
  assert.equal(calls.length, 0);
});

test("removing reduce-motion class re-enables haptics", () => {
  resetState();
  document.body.classList.add('reduce-motion');
  haptics.tap();
  document.body.classList.remove('reduce-motion');
  haptics.tap();
  assert.deepEqual(calls, [8]);
});

test("vibrate throwing does not bubble up to the caller", () => {
  resetState();
  // Replace navigator.vibrate with a thrower.
  const real = navigator.vibrate;
  navigator.vibrate = () => { throw new Error('boom'); };
  try {
    // Should swallow the throw and just return.
    haptics.tap();
    haptics.match(3);
    haptics.cascade(4);
    // No assertion needed — getting here means the throw was caught.
  } finally {
    navigator.vibrate = real;
  }
});
