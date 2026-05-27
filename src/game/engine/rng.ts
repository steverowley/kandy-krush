/**
 * mulberry32 — a small, fast, well-distributed seeded PRNG. The returned
 * function is callable as `() => number`, and also exposes its internal
 * state so the run can be serialized + resumed exactly across reloads.
 */
export type SeededRng = (() => number) & {
  state: () => number;
  setState: (s: number) => void;
};

export function createRng(seed: number): SeededRng {
  let s = seed >>> 0;
  const fn = function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  } as SeededRng;
  fn.state = () => s;
  fn.setState = (next: number) => {
    s = next >>> 0;
  };
  return fn;
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
