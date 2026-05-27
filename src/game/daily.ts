/**
 * The Daily Draw: a single fixed reading available to every player each
 * UTC day. The seed is derived from the date so that everyone's board
 * is identical, and the result is recorded once per day.
 */

export const DAILY_MOVE_BUDGET = 25;
export const DAILY_ROWS = 7;
export const DAILY_COLS = 7;

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
