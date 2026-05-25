// i18n primitives test.
// Run with: node --test tests/i18n.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, getLocale, setLocale, formatNumber } from '../src/i18n.js';

test('default locale is en', () => {
  assert.equal(getLocale(), 'en');
});

test('t() returns the translation for a known key', () => {
  assert.equal(t('start.title'), 'Sweet Match');
});

test('t() falls back to the key for an unknown lookup', () => {
  assert.equal(t('not.a.real.key'), 'not.a.real.key');
});

test('t() interpolates {token} placeholders', () => {
  const result = t('start.resume', { classIcon: '⚔', slot: 5, total: 100 });
  assert.ok(result.includes('5'));
  assert.ok(result.includes('100'));
  assert.ok(result.includes('⚔'));
});

test('t() with non-string key returns empty string', () => {
  assert.equal(t(null), '');
  assert.equal(t(undefined), '');
  assert.equal(t(42), '');
});

test('formatNumber respects locale digit grouping', () => {
  // en-US uses commas
  assert.equal(formatNumber(1234567), '1,234,567');
});

test('setLocale rejects unknown locales without changing active', () => {
  const before = getLocale();
  setLocale('xx-no-such-locale');
  assert.equal(getLocale(), before);
});
