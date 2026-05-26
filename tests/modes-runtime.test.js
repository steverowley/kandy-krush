// Mode runtime tests — src/modes/index.js.
//
// Scaffolding PR — verifies registry, lifecycle ordering, and the
// "skip teardown on re-enter" rule. Later PRs will add per-mode
// behavior tests as state moves into modes/<id>.js.
//
// Run with: node --test tests/modes-runtime.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerMode,
  getMode,
  listModes,
  getActiveMode,
  setActiveMode,
  _reset,
} from '../src/modes/index.js';

beforeEach(() => { _reset(); });

test('registerMode rejects bad input', () => {
  assert.throws(() => registerMode(null));
  assert.throws(() => registerMode({}));
  assert.throws(() => registerMode({ id: 'x' })); // no enter/exit
  assert.throws(() => registerMode({ id: 'x', enter: () => {} })); // no exit
});

test('registerMode + getMode round-trip', () => {
  const m = { id: 'a', enter() {}, exit() {} };
  registerMode(m);
  assert.equal(getMode('a'), m);
  assert.equal(getMode('zzz'), null);
});

test('listModes returns every registered mode', () => {
  const a = { id: 'a', enter() {}, exit() {} };
  const b = { id: 'b', enter() {}, exit() {} };
  registerMode(a);
  registerMode(b);
  const list = listModes();
  assert.equal(list.length, 2);
  assert.ok(list.includes(a));
  assert.ok(list.includes(b));
});

test('setActiveMode throws on unknown id', async () => {
  await assert.rejects(setActiveMode('not-registered'), /unknown mode/);
});

test('setActiveMode calls enter on the new mode', async () => {
  const calls = [];
  registerMode({
    id: 'a',
    enter(opts) { calls.push({ kind: 'enter-a', opts }); },
    exit() { calls.push({ kind: 'exit-a' }); },
  });
  await setActiveMode('a', { foo: 1 });
  assert.deepEqual(calls, [{ kind: 'enter-a', opts: { foo: 1 } }]);
  assert.equal(getActiveMode().id, 'a');
});

test('setActiveMode tears down the previous mode before entering the new one', async () => {
  const order = [];
  registerMode({
    id: 'a',
    enter() { order.push('enter-a'); },
    exit() { order.push('exit-a'); },
  });
  registerMode({
    id: 'b',
    enter() { order.push('enter-b'); },
    exit() { order.push('exit-b'); },
  });
  await setActiveMode('a');
  await setActiveMode('b');
  // a.exit happens BEFORE b.enter — that's the whole point.
  assert.deepEqual(order, ['enter-a', 'exit-a', 'enter-b']);
});

test('setActiveMode skips teardown when re-entering the same mode', async () => {
  const order = [];
  registerMode({
    id: 'a',
    enter() { order.push('enter-a'); },
    exit() { order.push('exit-a'); },
  });
  await setActiveMode('a');
  await setActiveMode('a');
  // Two enters, NO exit in between — re-entering refreshes, doesn't tear down.
  assert.deepEqual(order, ['enter-a', 'enter-a']);
});

test('setActiveMode awaits an async enter', async () => {
  const order = [];
  registerMode({
    id: 'a',
    async enter() {
      await new Promise((r) => setTimeout(r, 5));
      order.push('enter-a-done');
    },
    exit() {},
  });
  await setActiveMode('a');
  assert.deepEqual(order, ['enter-a-done']);
});

test('a throwing exit() does NOT block the next mode from entering', async () => {
  const order = [];
  registerMode({
    id: 'a',
    enter() { order.push('enter-a'); },
    exit() { throw new Error('boom'); },
  });
  registerMode({
    id: 'b',
    enter() { order.push('enter-b'); },
    exit() {},
  });
  await setActiveMode('a');
  await setActiveMode('b');
  // b.enter still fired even though a.exit threw.
  assert.deepEqual(order, ['enter-a', 'enter-b']);
});
