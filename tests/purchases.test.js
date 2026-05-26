// IAP shim test — verifies the grant handlers wire correctly.
// Run with: node --test tests/purchases.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as purchases from '../src/purchases.js';

test('without init, purchase returns IAP_NOT_CONFIGURED', async () => {
  purchases.init(null, null);
  const r = await purchases.purchase('any-sku');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'IAP_NOT_CONFIGURED');
});

test('grantGems without handler returns GRANT_HANDLER_NOT_REGISTERED', () => {
  purchases.init(null, null);
  const r = purchases.grantGems(10, 'test');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'GRANT_HANDLER_NOT_REGISTERED');
});

test('grantGems calls registered handler', () => {
  const calls = [];
  purchases.init(null, {
    grantGems: (n, reason) => { calls.push({ n, reason }); return { ok: true, granted: { kind: 'gems', qty: n } }; },
  });
  const r = purchases.grantGems(50, 'iap-pack-1');
  assert.equal(r.ok, true);
  assert.deepEqual(calls, [{ n: 50, reason: 'iap-pack-1' }]);
});

test('isAvailable reflects provider presence', () => {
  purchases.init(null, null);
  assert.equal(purchases.isAvailable(), false);
  purchases.init({ isAvailable: () => true, listCatalog: () => [], purchase: async () => ({ ok: true }) }, null);
  assert.equal(purchases.isAvailable(), true);
});

test('listCatalog defaults to []', () => {
  purchases.init(null, null);
  assert.deepEqual(purchases.listCatalog(), []);
});

test('purchase forwards to provider', async () => {
  let called = null;
  purchases.init({
    isAvailable: () => true,
    listCatalog: () => [],
    purchase: async (sku) => { called = sku; return { ok: true, granted: { kind: 'gems', qty: 100 } }; },
  }, null);
  const r = await purchases.purchase('test-sku');
  assert.equal(called, 'test-sku');
  assert.equal(r.ok, true);
});

test('purchase swallows a throwing provider — game must not break on bad SKUs', async () => {
  purchases.init({
    isAvailable: () => true,
    listCatalog: () => [],
    purchase: async () => { throw new Error('STORE_OFFLINE'); },
  }, null);
  const r = await purchases.purchase('bad-sku');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'STORE_OFFLINE');
});

test('purchase coerces non-Error throws to a string error', async () => {
  purchases.init({
    isAvailable: () => true,
    listCatalog: () => [],
    purchase: async () => { throw 'plain-string-error'; },
  }, null);
  const r = await purchases.purchase('bad-sku');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'plain-string-error');
});

test('listCatalog forwards to provider and tolerates a throwing one', () => {
  purchases.init({
    isAvailable: () => true,
    listCatalog: () => [{ sku: 'p1', displayName: 'Pack 1', qty: 100 }],
    purchase: async () => ({ ok: true }),
  }, null);
  assert.deepEqual(purchases.listCatalog(), [
    { sku: 'p1', displayName: 'Pack 1', qty: 100 },
  ]);
  // Throwing catalog → []
  purchases.init({
    isAvailable: () => true,
    listCatalog: () => { throw new Error('catalog-fail'); },
    purchase: async () => ({ ok: true }),
  }, null);
  assert.deepEqual(purchases.listCatalog(), []);
});

test('grantPowerup wires through the handler', () => {
  const calls = [];
  purchases.init(null, {
    grantPowerup: (kind, n) => { calls.push({ kind, n }); return { ok: true, granted: { kind, qty: n } }; },
  });
  const r = purchases.grantPowerup('hammer', 3);
  assert.equal(r.ok, true);
  assert.deepEqual(calls, [{ kind: 'hammer', n: 3 }]);
});

test('grantPowerup without handler returns GRANT_HANDLER_NOT_REGISTERED', () => {
  purchases.init(null, null);
  const r = purchases.grantPowerup('hammer', 3);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'GRANT_HANDLER_NOT_REGISTERED');
});

test('unlockSkipForLevel wires through the handler', () => {
  const calls = [];
  purchases.init(null, {
    unlockSkipForLevel: (id) => { calls.push(id); return { ok: true }; },
  });
  const r = purchases.unlockSkipForLevel(42);
  assert.equal(r.ok, true);
  assert.deepEqual(calls, [42]);
});

test('unlockSkipForLevel without handler returns GRANT_HANDLER_NOT_REGISTERED', () => {
  purchases.init(null, null);
  const r = purchases.unlockSkipForLevel(42);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'GRANT_HANDLER_NOT_REGISTERED');
});

test('_state diagnostic reflects whether provider + handlers are present', () => {
  purchases.init(null, null);
  assert.deepEqual(purchases._state(), { hasProvider: false, hasGrantHandlers: false });
  purchases.init({ isAvailable: () => false, listCatalog: () => [], purchase: async () => ({}) }, null);
  assert.deepEqual(purchases._state(), { hasProvider: true, hasGrantHandlers: false });
  purchases.init(null, { grantGems: () => ({ ok: true }) });
  assert.deepEqual(purchases._state(), { hasProvider: false, hasGrantHandlers: true });
});

test('isAvailable handles a provider with no isAvailable method', () => {
  // Truthy provider but no isAvailable function → false.
  purchases.init({ listCatalog: () => [], purchase: async () => ({}) }, null);
  assert.equal(purchases.isAvailable(), false);
});

// Reset module state for any subsequent test runs.
purchases.init(null, null);
