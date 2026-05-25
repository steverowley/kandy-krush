// Internationalization shim.
//
// Phase B10 scope: PRIMITIVES ONLY. The codebase today is one big English
// string soup — every flashMessage, button label, speech.speak, achievement
// banner. Migrating all of it in one PR is invasive and the user is still
// EN-only. So this PR ships:
//
//   - `t(key, params?)` — looks up a string by dotted key in the active
//     dictionary, with fallback to the key itself so anything that
//     hasn't been migrated yet still renders the (English) raw string.
//   - `setLocale(code)` — swaps the active dictionary. Defaults to 'en'.
//   - `getLocale()` — returns the active code.
//   - `formatNumber(n, opts)` — `Intl.NumberFormat` wrapper so scores /
//     gems display with locale-appropriate digit grouping (1,000 vs 1.000).
//
// New text added going forward should use `t()`. Existing strings will
// migrate incrementally (a follow-up PR can sweep `flashMessage(...)`
// sites once we have a real second locale to validate against).
//
// No PII, no network. Strings live in `strings.<locale>.json` files
// that are import()ed on demand so we don't ship every locale to every
// player at boot.

import enStrings from './strings.en.js';

const DICTS = {
  en: enStrings,
};

let active = 'en';
let dict = DICTS.en;
let numberFormatter = new Intl.NumberFormat('en-US');

export function getLocale() { return active; }

export function setLocale(code) {
  if (!DICTS[code]) {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] unknown locale "${code}", staying on "${active}"`);
    return false;
  }
  active = code;
  dict = DICTS[code];
  try {
    numberFormatter = new Intl.NumberFormat(localeToBCP47(code));
  } catch {
    numberFormatter = new Intl.NumberFormat('en-US');
  }
  return true;
}

function localeToBCP47(code) {
  // Map our short codes to BCP-47 tags Intl can parse.
  const map = { en: 'en-US', es: 'es-ES', pt: 'pt-BR', ja: 'ja-JP', ko: 'ko-KR', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', zh: 'zh-CN' };
  return map[code] || code;
}

// Look up a dotted-path key (e.g. "start.subtitle"). If missing, fall
// back to the key itself so dev sees obvious "missing translation"
// markers without crashing the UI. `params` does simple `{name}` token
// replacement.
export function t(key, params) {
  if (typeof key !== 'string') return '';
  const segments = key.split('.');
  let cursor = dict;
  for (const seg of segments) {
    if (cursor && typeof cursor === 'object' && seg in cursor) {
      cursor = cursor[seg];
    } else {
      return key; // fallback: render the key as-is so the gap is visible
    }
  }
  if (typeof cursor !== 'string') return key;
  if (!params) return cursor;
  return cursor.replace(/\{(\w+)\}/g, (_, name) => {
    if (name in params) return String(params[name]);
    return `{${name}}`; // leave unknown placeholders intact for dev visibility
  });
}

export function formatNumber(n, opts) {
  if (opts) {
    try {
      return new Intl.NumberFormat(localeToBCP47(active), opts).format(n);
    } catch {
      return String(n);
    }
  }
  return numberFormatter.format(n);
}

// Test helper — direct dict access for assertion tests, never used by app.
export function _getDict() { return dict; }
