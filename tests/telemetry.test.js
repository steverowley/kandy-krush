// Telemetry shim tests — src/telemetry.js.
//
// The shim has to satisfy three guarantees the rest of the codebase
// relies on:
//   1. `track()` never breaks the game — bad endpoint, storage quota,
//      private mode, missing crypto API, missing window, etc. all
//      degrade silently.
//   2. Events get buffered (last N) so a crash report can include
//      recent activity.
//   3. The 'console' / 'noop' / 'beacon' provider switch is honored.
//
// Run with: node --test tests/telemetry.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- polyfill storage + crypto + window for the module's boot ---

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
  get length() { return this.map.size; }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
if (!globalThis.crypto) globalThis.crypto = {};

// Capture sendBeacon usage.
const beacons = [];
Object.defineProperty(globalThis, 'navigator', {
  value: {
    sendBeacon(endpoint, body) {
      beacons.push({ endpoint, body });
      return true;
    },
  },
  configurable: true,
  writable: true,
});

// Force a Blob shim that exposes .parts for test inspection. Node 22's
// native Blob hides its contents behind an async .text() — we need
// synchronous access to verify the beacon body.
Object.defineProperty(globalThis, 'Blob', {
  value: class Blob { constructor(parts, opts) { this.parts = parts; this.opts = opts; } },
  configurable: true,
  writable: true,
});

// No window in this env; the module's window check should detect that
// and skip the crash listeners. Don't define window.

const telemetry = await import('../src/telemetry.js');

function resetEnv() {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  beacons.length = 0;
}

// --- init() ---

test("init defaults provider to 'console' and assigns device + session ids", () => {
  resetEnv();
  telemetry.init();
  const cfg = telemetry._getConfig();
  assert.equal(cfg.provider, 'console');
  assert.ok(cfg.deviceId, 'deviceId should be set');
  assert.ok(cfg.sessionId, 'sessionId should be set');
});

test("init persists deviceId across boots (localStorage)", () => {
  resetEnv();
  telemetry.init();
  const id1 = telemetry._getConfig().deviceId;
  // Re-init without clearing storage → same device id.
  telemetry.init();
  const id2 = telemetry._getConfig().deviceId;
  assert.equal(id1, id2);
});

test("init regenerates deviceId when localStorage is cleared", () => {
  resetEnv();
  telemetry.init();
  const id1 = telemetry._getConfig().deviceId;
  resetEnv();
  telemetry.init();
  const id2 = telemetry._getConfig().deviceId;
  assert.notEqual(id1, id2);
});

test("init accepts options and merges with defaults", () => {
  resetEnv();
  telemetry.init({ provider: 'noop', appVersion: '1.2.3' });
  const cfg = telemetry._getConfig();
  assert.equal(cfg.provider, 'noop');
  assert.equal(cfg.appVersion, '1.2.3');
});

// --- track() and buffer ---

test("track pushes events into the buffer", () => {
  resetEnv();
  telemetry.init({ provider: 'noop' });
  telemetry.track('test_event', { x: 1 });
  telemetry.track('another', { y: 2 });
  const buf = telemetry._getBuffer();
  assert.equal(buf.length, 2);
  assert.equal(buf[0].name, 'test_event');
  assert.equal(buf[0].props.x, 1);
  assert.equal(buf[1].name, 'another');
});

test("track caps the buffer at 50 events (oldest dropped)", () => {
  resetEnv();
  telemetry.init({ provider: 'noop' });
  for (let i = 0; i < 60; i++) telemetry.track(`event-${i}`, { i });
  const buf = telemetry._getBuffer();
  assert.equal(buf.length, 50);
  // Newest is event-59; oldest in the cap is event-10.
  assert.equal(buf[0].name, 'event-10');
  assert.equal(buf[49].name, 'event-59');
});

test("track records a timestamp", () => {
  resetEnv();
  telemetry.init({ provider: 'noop' });
  const before = Date.now();
  telemetry.track('clock', {});
  const after = Date.now();
  const evt = telemetry._getBuffer().at(-1);
  assert.ok(evt.ts >= before && evt.ts <= after);
});

test("track stamps every event with sessionId + deviceId + appVersion", () => {
  resetEnv();
  telemetry.init({ provider: 'noop', appVersion: '9.9.9' });
  telemetry.track('stamped', {});
  const evt = telemetry._getBuffer().at(-1);
  const cfg = telemetry._getConfig();
  assert.equal(evt.sessionId, cfg.sessionId);
  assert.equal(evt.deviceId, cfg.deviceId);
  assert.equal(evt.appVersion, '9.9.9');
});

// --- userProps ---

test("setUserProps merges into every subsequent event's user field", () => {
  resetEnv();
  telemetry.init({ provider: 'noop' });
  telemetry.setUserProps({ class: 'champion' });
  telemetry.track('with-user', {});
  let evt = telemetry._getBuffer().at(-1);
  assert.deepEqual(evt.user, { class: 'champion' });
  // Adding more props merges.
  telemetry.setUserProps({ runsCompleted: 3 });
  telemetry.track('with-user-2', {});
  evt = telemetry._getBuffer().at(-1);
  assert.deepEqual(evt.user, { class: 'champion', runsCompleted: 3 });
});

// --- beacon provider ---

test("beacon provider posts events via navigator.sendBeacon", () => {
  resetEnv();
  telemetry.init({ provider: 'beacon', endpoint: 'https://example.test/log' });
  telemetry.track('boot', { foo: 'bar' });
  assert.equal(beacons.length, 1);
  assert.equal(beacons[0].endpoint, 'https://example.test/log');
});

test("beacon provider is a no-op when no endpoint is configured", () => {
  resetEnv();
  telemetry.init({ provider: 'beacon', endpoint: null });
  telemetry.track('boot', {});
  assert.equal(beacons.length, 0);
});

test("beacon swallows a throwing sendBeacon (game must not break)", () => {
  resetEnv();
  const real = navigator.sendBeacon;
  navigator.sendBeacon = () => { throw new Error('beacon boom'); };
  try {
    telemetry.init({ provider: 'beacon', endpoint: 'https://example.test/log' });
    // Must not throw.
    telemetry.track('survives', {});
  } finally {
    navigator.sendBeacon = real;
  }
});

// --- noop provider ---

test("noop provider doesn't call sendBeacon", () => {
  resetEnv();
  telemetry.init({ provider: 'noop' });
  telemetry.track('quiet', {});
  assert.equal(beacons.length, 0);
});

// --- captureError ---

test("captureError ships an event with stack + message + recent_events", () => {
  resetEnv();
  telemetry.init({ provider: 'beacon', endpoint: 'https://example.test/log' });
  telemetry.track('breadcrumb-1', {});
  telemetry.track('breadcrumb-2', {});
  const err = new Error('boom');
  telemetry.captureError(err, { source: 'unit-test' });
  assert.equal(beacons.length, 3, 'one beacon per track + one for the error');
  const body = JSON.parse(beacons.at(-1).body.parts[0]);
  assert.equal(body.name, 'error');
  assert.equal(body.props.message, 'boom');
  assert.ok(body.props.stack && body.props.stack.length > 0);
  assert.equal(body.props.source, 'unit-test');
  // recent_events includes the breadcrumbs.
  assert.ok(Array.isArray(body.props.recent_events));
  const names = body.props.recent_events.map((e) => e.name);
  assert.ok(names.includes('breadcrumb-1'));
  assert.ok(names.includes('breadcrumb-2'));
});

test("captureError handles a thrown non-Error gracefully", () => {
  resetEnv();
  telemetry.init({ provider: 'noop' });
  // Should not throw.
  telemetry.captureError('plain string thrown', { source: 'unit-test' });
});

test("captureError does NOT add the error event to the recent-event buffer", () => {
  resetEnv();
  telemetry.init({ provider: 'noop' });
  telemetry.track('regular', {});
  telemetry.captureError(new Error('one'), {});
  const buf = telemetry._getBuffer();
  // Only the 'regular' event should be in the buffer; error is reported
  // standalone but doesn't fill the breadcrumb buffer.
  assert.equal(buf.length, 1);
  assert.equal(buf[0].name, 'regular');
});
