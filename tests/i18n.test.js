// i18n primitives test.
// Run with: node --test tests/i18n.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, getLocale, setLocale, formatNumber } from '../src/i18n.js';

test('default locale is en', () => {
  assert.equal(getLocale(), 'en');
});

test('t() returns the translation for a known key', () => {
  assert.equal(t('start.title'), 'Arcana Cascada');
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

test('setLocale returns false for unknown locales and true for known', () => {
  assert.equal(setLocale('xx-no-such-locale'), false);
  assert.equal(setLocale('en'), true);
});

test("t() leaves unknown placeholders intact for dev visibility", () => {
  // Use 'start.resume' which references {classIcon}, {slot}, {total}.
  // If we omit a placeholder, the literal `{name}` survives.
  const result = t('start.resume', { slot: 5, total: 100 });
  assert.ok(result.includes('{classIcon}'), 'unknown placeholder preserved');
});

test("t() walks dotted paths through nested dicts", () => {
  // Looking up a partial path that lands on a non-string (object) should
  // fall back to the key string. We're not depending on a specific dict
  // shape; just verify it doesn't crash and returns the key.
  const partialPath = 'start';
  // 'start' lookup lands on an object node — that returns the key.
  assert.equal(t(partialPath), partialPath);
});

test("t() with empty-string params object behaves the same as no-params", () => {
  const a = t('start.title');
  const b = t('start.title', {});
  assert.equal(a, b);
});

test("formatNumber accepts options and honors them", () => {
  // Force a currency format — should produce something with $ or USD.
  const out = formatNumber(1234.56, { style: 'currency', currency: 'USD' });
  // Match either "$" or "USD" in the output (locale-dependent).
  assert.match(out, /\$|USD/);
});

test("formatNumber tolerates a bad options object — falls back to String(n)", () => {
  // Pass a truly invalid options that NumberFormat will throw on.
  const out = formatNumber(42, { style: 'currency', currency: 'NOT_A_CURRENCY' });
  // Either it surfaced a fallback "42" string OR it produced SOMETHING
  // (Intl may have its own fallback). We just verify it doesn't throw.
  assert.ok(typeof out === 'string' && out.length > 0);
});

test("formatNumber handles 0 + negative numbers", () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(-1234567), '-1,234,567');
});

test("_getDict returns the active dictionary", async () => {
  const i18n = await import('../src/i18n.js');
  const d = i18n._getDict();
  // The dictionary should be an object with a 'start' branch (we use
  // start.title elsewhere).
  assert.ok(d && typeof d === 'object');
  assert.ok(d.start && typeof d.start === 'object');
});
