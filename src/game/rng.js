// Seedable PRNG for daily-seed runs.
//
// The roguelike pickers (upgrades, relics, mutators, crazy kinds) call
// Math.random directly today, which means every run is unique and we
// can't ship a "daily seed" feature without a deterministic source of
// randomness.
//
// This module provides:
//   - `createRng(seed)` — returns a 32-bit-state PRNG function. Each
//     call returns a fresh [0, 1) number. mulberry32 is fast, has no
//     biases that matter for game logic, and fits in 10 lines.
//   - `dailySeed(date?)` — derives a 32-bit seed from YYYYMMDD so
//     everyone on the same calendar day gets the same seed. UTC date
//     so global players land on the same daily across time zones.
//   - `randInt(rng, max)` / `pickFrom(rng, arr)` / `shuffleInPlace(rng, arr)`
//     are convenience wrappers so consumers don't reinvent rejection
//     sampling and Fisher-Yates each time.

export function createRng(seed) {
  let s = (seed >>> 0) || 1;
  return function rng() {
    // mulberry32
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailySeed(date = new Date()) {
  // YYYYMMDD as a UTC integer keyed off the player's calendar day.
  // UTC keeps players in different time zones on the same seed for
  // the same global "daily" — Balatro / Spire convention.
  const yyyy = date.getUTCFullYear();
  const mm = date.getUTCMonth() + 1;
  const dd = date.getUTCDate();
  // Spread the bits a little so consecutive days produce different
  // PRNG behavior (sequential seeds give correlated mulberry32 output).
  let h = yyyy * 10000 + mm * 100 + dd;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function dailySeedStamp(date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function randInt(rng, max) {
  return Math.floor(rng() * max);
}

export function pickFrom(rng, arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffleInPlace(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
