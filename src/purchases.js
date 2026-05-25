// In-app purchase shim.
//
// Phase B9 scope: PLUMBING ONLY. Today the game has zero monetization
// and the product owner hasn't picked a provider yet (RevenueCat,
// native StoreKit/BillingClient via Capacitor, Stripe Checkout for
// web, …). This module exists so:
//
//   1. Every site in the game that grants a rewardable resource
//      (gems, power-ups, extra moves, level skips) can call the same
//      API today as it will when IAP ships.
//   2. The day a provider is picked, we swap THIS file's `_provider`
//      implementation — no other code in the game changes.
//   3. We can ship a "ghost" UI (e.g. a Gem Store button that opens
//      "Coming soon") without committing to a backend.
//
// API surface — keep it boring:
//
//   - listCatalog()             → array of { sku, kind, qty, displayName, priceText? }
//   - purchase(sku)             → Promise<{ ok, granted?: {kind, qty}, error? }>
//   - grantGems(n, reason)      → state-mutating helper used by IAP +
//                                 promo flows.
//   - grantPowerup(kind, n)     → same.
//   - unlockSkipForLevel(id)    → marks a level skippable on fail.
//   - isAvailable()             → true once a real provider is wired.
//
// Today every grant returns `{ ok: false, error: 'IAP_NOT_CONFIGURED' }`
// and the catalog is empty. Once we pick RevenueCat (or whatever),
// `_provider` swaps to a real implementation and the rest of the game
// is plumbing-complete.

let _provider = null;            // { listCatalog, purchase, isAvailable }
let _grantHandlers = null;       // { grantGems, grantPowerup, unlockSkipForLevel }

export function init(provider, grantHandlers) {
  _provider = provider || null;
  _grantHandlers = grantHandlers || null;
}

export function isAvailable() {
  return !!(_provider && _provider.isAvailable && _provider.isAvailable());
}

export function listCatalog() {
  if (_provider && _provider.listCatalog) {
    try { return _provider.listCatalog(); } catch { return []; }
  }
  return [];
}

export async function purchase(sku) {
  if (!_provider || !_provider.purchase) {
    return { ok: false, error: 'IAP_NOT_CONFIGURED' };
  }
  try {
    return await _provider.purchase(sku);
  } catch (err) {
    return { ok: false, error: err && err.message || String(err) };
  }
}

export function grantGems(n, reason) {
  if (_grantHandlers && _grantHandlers.grantGems) {
    return _grantHandlers.grantGems(n, reason);
  }
  return { ok: false, error: 'GRANT_HANDLER_NOT_REGISTERED' };
}

export function grantPowerup(kind, n) {
  if (_grantHandlers && _grantHandlers.grantPowerup) {
    return _grantHandlers.grantPowerup(kind, n);
  }
  return { ok: false, error: 'GRANT_HANDLER_NOT_REGISTERED' };
}

export function unlockSkipForLevel(id) {
  if (_grantHandlers && _grantHandlers.unlockSkipForLevel) {
    return _grantHandlers.unlockSkipForLevel(id);
  }
  return { ok: false, error: 'GRANT_HANDLER_NOT_REGISTERED' };
}

// Diagnostic — never used by app code, lets tests verify wiring.
export function _state() {
  return {
    hasProvider: !!_provider,
    hasGrantHandlers: !!_grantHandlers,
  };
}
