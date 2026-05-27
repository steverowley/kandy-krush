/**
 * The Parlour — Balatro-style shop visited every third chamber in
 * The Querent's Path. The player spends Coins earned by clearing
 * chambers to buy Arcana from a refreshable offer table.
 *
 * Brief §4.7. v1 keeps the scope tight: coin grants on chamber wins,
 * three Major Arcana offers per visit at a flat price, skip-to-leave.
 * Rerolls + Minor offers + Vouchers can layer in later PRs.
 */

import { MAJOR_ARCANA, rollDraw, type Arcana } from "./arcana";

/** Coin reward when the player clears a non-boss chamber. */
export const COINS_PER_CHAMBER = 5;
/** Bonus coin reward for clearing a Boss Blind. */
export const COINS_PER_BOSS = 10;
/** Price of a single Arcana offer in the Parlour. */
export const ARCANA_PRICE = 6;
/** How many offers the Parlour presents per visit. */
export const PARLOUR_OFFER_COUNT = 3;

/** Chambers (1-based) after which the player visits the Parlour rather
 *  than the standard Arcana Draw. Spread roughly every third chamber. */
export const PARLOUR_CHAMBERS: readonly number[] = [3, 6, 10];

/** True if clearing this chamber should route to /parlour instead of /draw. */
export function isParlourChamber(chamberIndex: number): boolean {
  return PARLOUR_CHAMBERS.includes(chamberIndex);
}

/** Coin reward for a chamber win. `multiplier` lets stake rules scale
 *  payouts (e.g. Orange halves them). Result is rounded so the wallet
 *  stays in whole coins. */
export function coinsForChamber(opts: {
  isBoss: boolean;
  multiplier?: number;
}): number {
  const base = COINS_PER_CHAMBER + (opts.isBoss ? COINS_PER_BOSS : 0);
  return Math.round(base * (opts.multiplier ?? 1));
}

/**
 * Roll a Parlour offer table. Excludes Arcana the player already holds
 * so they're never sold a duplicate. Uses the supplied PRNG so a stored
 * seed can re-roll the same offers across a reload.
 */
export function rollParlourOffers(
  held: readonly Arcana[],
  rng: () => number,
  count: number = PARLOUR_OFFER_COUNT,
): Arcana[] {
  return rollDraw(MAJOR_ARCANA, held, rng, count);
}
