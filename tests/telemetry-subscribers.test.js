// Telemetry-subscriber tests — verifies that each bus event the
// telemetry subscriber listens to translates into the correct
// telemetry.track() call shape. The bus is the contract; this
// test enforces it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as bus from '../src/game/event-bus.js';
import * as telemetrySubscribers from '../src/subscribers/telemetry.js';

function makeFakeTelemetry() {
  const calls = [];
  return {
    calls,
    track(name, payload) { calls.push({ name, payload }); },
  };
}

function setup() {
  bus.clear();
  const telemetry = makeFakeTelemetry();
  const sub = telemetrySubscribers.register({ bus, telemetry });
  return { telemetry, sub };
}

test("mode:picked → telemetry.track('mode_picked', { mode })", () => {
  const { telemetry } = setup();
  bus.emit('mode:picked', { mode: 'roguelike' });
  assert.equal(telemetry.calls.length, 1);
  assert.equal(telemetry.calls[0].name, 'mode_picked');
  assert.deepEqual(telemetry.calls[0].payload, { mode: 'roguelike' });
});

test("run:class_chosen → run_start with shaped payload", () => {
  const { telemetry } = setup();
  bus.emit('run:class_chosen', {
    class: 'champion',
    archetype: 'aoe',
    startingUpgrades: ['aoe', 'aoe'],
    runsCompletedBefore: 3,
  });
  assert.equal(telemetry.calls[0].name, 'run_start');
  assert.deepEqual(telemetry.calls[0].payload, {
    class: 'champion',
    archetype: 'aoe',
    starting_upgrades: ['aoe', 'aoe'],
    runs_completed_before: 3,
  });
});

test("daily:start → daily_seed_start with stamp", () => {
  const { telemetry } = setup();
  bus.emit('daily:start', { stamp: '2026-05-26' });
  assert.equal(telemetry.calls[0].name, 'daily_seed_start');
  assert.deepEqual(telemetry.calls[0].payload, { stamp: '2026-05-26' });
});

test("ascension:picked → ascension_picked with level", () => {
  const { telemetry } = setup();
  bus.emit('ascension:picked', { level: 2 });
  assert.equal(telemetry.calls[0].name, 'ascension_picked');
  assert.deepEqual(telemetry.calls[0].payload, { level: 2 });
});

test("off() tears down every subscriber so later emits are silent", () => {
  const { telemetry, sub } = setup();
  sub.off();
  bus.emit('mode:picked', { mode: 'roguelike' });
  bus.emit('run:class_chosen', {});
  bus.emit('daily:start', {});
  bus.emit('ascension:picked', {});
  assert.equal(telemetry.calls.length, 0);
});

test("a handler that throws cannot brick the bus (handlers run isolated)", () => {
  bus.clear();
  const telemetry = makeFakeTelemetry();
  // Sneak a throwing handler in first; the bus catches + logs.
  bus.on('mode:picked', () => { throw new Error('boom'); });
  telemetrySubscribers.register({ bus, telemetry });
  bus.emit('mode:picked', { mode: 'levels' });
  // Telemetry subscriber still fired despite the prior throw.
  assert.equal(telemetry.calls.length, 1);
  assert.equal(telemetry.calls[0].name, 'mode_picked');
});
