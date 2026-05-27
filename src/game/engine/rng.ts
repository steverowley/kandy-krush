/**
 * mulberry32 — a small, fast, well-distributed seeded PRNG.
 * Returns a function that yields floats in [0, 1).
 */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a uniform integer in [0, max). */
export function rngInt(rng: () => number, max: number): number {
  return Math.floor(rng() * max);
}

/** Pick a uniform element from a non-empty array. */
export function rngPick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error("rngPick: empty");
  return items[rngInt(rng, items.length)]!;
}
