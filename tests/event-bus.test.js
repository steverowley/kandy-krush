// Event-bus test — verifies emit/on/off semantics + handler isolation.
// Run with: node --test tests/event-bus.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { on, off, emit, clear, _handlerCount } from '../src/game/event-bus.js';

beforeEach(() => clear());

test('on() registers, emit() fires, off() removes', () => {
  let count = 0;
  const fn = () => count++;
  const unsub = on('match', fn);
  emit('match', {});
  emit('match', {});
  assert.equal(count, 2);
  unsub();
  emit('match', {});
  assert.equal(count, 2);
});

test('payload is passed verbatim to handlers', () => {
  let received;
  on('slot:start', (p) => { received = p; });
  emit('slot:start', { slot: 7, isBoss: false });
  assert.deepEqual(received, { slot: 7, isBoss: false });
});

test('multiple handlers on the same event each fire', () => {
  const calls = [];
  on('cascade', () => calls.push('a'));
  on('cascade', () => calls.push('b'));
  emit('cascade', {});
  assert.deepEqual(calls, ['a', 'b']);
});

test('off() with named handler removes only that one', () => {
  const calls = [];
  const a = () => calls.push('a');
  const b = () => calls.push('b');
  on('special:birth', a);
  on('special:birth', b);
  off('special:birth', a);
  emit('special:birth', {});
  assert.deepEqual(calls, ['b']);
});

test('handlers that throw are isolated — bus keeps going', () => {
  const calls = [];
  on('match', () => { throw new Error('boom'); });
  on('match', () => calls.push('survived'));
  emit('match', {});
  assert.deepEqual(calls, ['survived']);
});

test('clear() removes every handler', () => {
  on('a', () => {});
  on('b', () => {});
  assert.equal(_handlerCount(), 2);
  clear();
  assert.equal(_handlerCount(), 0);
});

test('on() with invalid args returns a no-op unsub', () => {
  const unsub = on(null, () => {});
  assert.equal(typeof unsub, 'function');
  // Calling no-op shouldn't throw.
  unsub();
});

test('emit() on an unsubscribed event is a no-op', () => {
  // Just shouldn't throw.
  emit('nobody-listening', { x: 1 });
});

test('handlers can subscribe/unsubscribe during emit without breaking iteration', () => {
  const calls = [];
  on('match', () => {
    calls.push('a');
    on('match', () => calls.push('late'));
  });
  on('match', () => calls.push('b'));
  emit('match', {});
  // First emit: 'a' + 'b' (the late handler isn't part of this snapshot).
  assert.deepEqual(calls, ['a', 'b']);
  // Second emit: 'a' (re-registers another late) + 'b' + 'late'.
  emit('match', {});
  assert.ok(calls.includes('late'));
});
