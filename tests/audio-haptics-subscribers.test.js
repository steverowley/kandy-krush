// Tests for the audio + haptics bus subscribers introduced in
// modes-6. Each test exercises the event-to-call contract and the
// off() teardown.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as bus from '../src/game/event-bus.js';
import * as audioSubscribers from '../src/subscribers/audio.js';
import * as hapticsSubscribers from '../src/subscribers/haptics.js';

function makeFakeSfx() {
  const calls = [];
  return {
    calls,
    playMatch(size, level) { calls.push(['playMatch', size, level]); },
    playCascade() { calls.push(['playCascade']); },
  };
}

function makeFakeHaptics() {
  const calls = [];
  return {
    calls,
    match(intensity) { calls.push(['match', intensity]); },
    cascade(level) { calls.push(['cascade', level]); },
    specialBirth() { calls.push(['specialBirth']); },
  };
}

test("audio: bus.emit('match') -> sfx.playMatch with size + level", () => {
  bus.clear();
  const sfx = makeFakeSfx();
  audioSubscribers.register({ bus, sfx });
  bus.emit('match', { matchSize: 5, cascadeLevel: 2 });
  assert.deepEqual(sfx.calls, [['playMatch', 5, 2]]);
});

test("audio: bus.emit('cascade') -> sfx.playCascade", () => {
  bus.clear();
  const sfx = makeFakeSfx();
  audioSubscribers.register({ bus, sfx });
  bus.emit('cascade', { cascadeLevel: 3 });
  assert.deepEqual(sfx.calls, [['playCascade']]);
});

test('audio: off() removes every subscriber', () => {
  bus.clear();
  const sfx = makeFakeSfx();
  const sub = audioSubscribers.register({ bus, sfx });
  sub.off();
  bus.emit('match', { matchSize: 3, cascadeLevel: 1 });
  bus.emit('cascade', { cascadeLevel: 2 });
  assert.equal(sfx.calls.length, 0);
});

test('haptics: match intensity scales 1/2/3 from match size', () => {
  bus.clear();
  const haptics = makeFakeHaptics();
  hapticsSubscribers.register({ bus, haptics });
  bus.emit('match', { matchSize: 3, cascadeLevel: 1 });
  bus.emit('match', { matchSize: 4, cascadeLevel: 1 });
  bus.emit('match', { matchSize: 5, cascadeLevel: 1 });
  bus.emit('match', { matchSize: 6, cascadeLevel: 1 });
  assert.deepEqual(haptics.calls, [
    ['match', 1],
    ['match', 2],
    ['match', 3],
    ['match', 3],
  ]);
});

test('haptics: cascade intensity passes through cascade level', () => {
  bus.clear();
  const haptics = makeFakeHaptics();
  hapticsSubscribers.register({ bus, haptics });
  bus.emit('cascade', { cascadeLevel: 4 });
  assert.deepEqual(haptics.calls, [['cascade', 4]]);
});

test("haptics: special:birth -> haptics.specialBirth", () => {
  bus.clear();
  const haptics = makeFakeHaptics();
  hapticsSubscribers.register({ bus, haptics });
  bus.emit('special:birth', { type: 0, c: 1, r: 2, kind: 'line' });
  assert.deepEqual(haptics.calls, [['specialBirth']]);
});

test('haptics: off() removes every subscriber', () => {
  bus.clear();
  const haptics = makeFakeHaptics();
  const sub = hapticsSubscribers.register({ bus, haptics });
  sub.off();
  bus.emit('match', { matchSize: 3, cascadeLevel: 1 });
  bus.emit('cascade', { cascadeLevel: 2 });
  bus.emit('special:birth', { type: 0 });
  assert.equal(haptics.calls.length, 0);
});

test('audio + haptics together fire on the same event without interfering', () => {
  bus.clear();
  const sfx = makeFakeSfx();
  const haptics = makeFakeHaptics();
  audioSubscribers.register({ bus, sfx });
  hapticsSubscribers.register({ bus, haptics });
  bus.emit('match', { matchSize: 5, cascadeLevel: 2 });
  assert.deepEqual(sfx.calls, [['playMatch', 5, 2]]);
  assert.deepEqual(haptics.calls, [['match', 3]]);
});

test('haptics: matchSize falls back to allCleared.size if matchSize absent', () => {
  bus.clear();
  const haptics = makeFakeHaptics();
  hapticsSubscribers.register({ bus, haptics });
  // Simulate the legacy payload shape (no `matchSize`, just `allCleared`).
  bus.emit('match', { allCleared: new Set([1, 2, 3, 4]), cascadeLevel: 1 });
  assert.deepEqual(haptics.calls, [['match', 2]]);
});
