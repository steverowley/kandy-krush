/**
 * The Daily Draw: a single fixed reading available to every player each
 * UTC day. The seed is derived from the date so that everyone's board
 * is identical, and the result is recorded once per day.
 */

import { MAJOR_ARCANA, type ArcanaId } from "./arcana";
import { createRng, rngPick } from "./engine/rng";

export const DAILY_MOVE_BUDGET = 25;
export const DAILY_ROWS = 7;
export const DAILY_COLS = 7;
/** Number of Major Arcana granted on a Daily run. */
export const DAILY_ARCANA_COUNT = 3;

/** ISO date key in UTC: "YYYY-MM-DD". Used as the day's identifier. */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Deterministically derive a 31-bit seed from the day-key. The hash is
 *  a small FNV-1a variant — collisions per year are irrelevant; we just
 *  need the same date to produce the same number worldwide. */
export function dailySeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) & 0x7fffffff;
}

/**
 * Pick the day's fixed Arcana hand — same key, same hand, worldwide.
 * Uses an offset of the daily seed so the arcana pool draws don't
 * collide with the board-generation rng's state space (different
 * concerns, want them independent).
 */
export function dailyArcana(key: string): ArcanaId[] {
  const baseSeed = dailySeed(key);
  // Bit-rotate the seed so the arcana draw doesn't share state with
  // board generation; both still deterministic per day.
  const arcanaSeed = ((baseSeed << 13) | (baseSeed >>> 19)) >>> 0;
  const rng = createRng(arcanaSeed);
  const pool = MAJOR_ARCANA.slice();
  const picks: ArcanaId[] = [];
  for (let i = 0; i < DAILY_ARCANA_COUNT && pool.length > 0; i++) {
    const arcana = rngPick(rng, pool);
    picks.push(arcana.id);
    pool.splice(pool.indexOf(arcana), 1);
  }
  return picks;
}
