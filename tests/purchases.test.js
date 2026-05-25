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

// Reset module state for any subsequent test runs.
purchases.init(null, null);
