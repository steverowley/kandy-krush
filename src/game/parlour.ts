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
import { MINOR_ARCANA, type MinorArcana } from "./minor-arcana";

/** Coin reward when the player clears a non-boss chamber. */
export const COINS_PER_CHAMBER = 5;
/** Bonus coin reward for clearing a Boss Blind. */
export const COINS_PER_BOSS = 10;
/** Price of a single Major Arcana offer in the Parlour. */
export const ARCANA_PRICE = 6;
/** Price of a single Minor Arcana offer in the Parlour. Cheaper than
 *  a Major because Minors are one-shot consumables. */
export const MINOR_PRICE = 3;
/** Coins charged for a Parlour reroll. */
export const REROLL_PRICE = 3;
/** How many offers the Parlour presents per visit. */
export const PARLOUR_OFFER_COUNT = 3;
/** Probability (0..1) that a Parlour offer slot rolls a Minor instead
 *  of a Major. */
export const MINOR_OFFER_CHANCE = 0.3;

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

export type ParlourOffer =
  | { kind: "major"; arcana: Arcana }
  | { kind: "minor"; minor: MinorArcana };

/**
 * Roll a mixed Parlour offer table. Each slot has a `minorChance`
 * probability of being a Minor; otherwise it draws a Major excluded
 * from `heldMajors` and from any prior Major already in this offer set
 * (so duplicates don't appear within one visit). Minors can repeat
 * across slots — they're consumables and the pool is small.
 */
export function rollMixedOffers(
  heldMajors: readonly Arcana[],
  rng: () => number,
  count: number = PARLOUR_OFFER_COUNT,
  minorChance: number = MINOR_OFFER_CHANCE,
): ParlourOffer[] {
  const result: ParlourOffer[] = [];
  const heldMajorIds = new Set(heldMajors.map((a) => a.id));
  const usedMajorIds = new Set<string>();
  for (let i = 0; i < count; i++) {
    const rollMinor = rng() < minorChance;
    if (rollMinor && MINOR_ARCANA.length > 0) {
      const minor =
        MINOR_ARCANA[Math.floor(rng() * MINOR_ARCANA.length)]!;
      result.push({ kind: "minor", minor });
      continue;
    }
    // Pick a Major not already held and not already in this offer set.
    const pool = MAJOR_ARCANA.filter(
      (a) => !heldMajorIds.has(a.id) && !usedMajorIds.has(a.id),
    );
    if (pool.length === 0) {
      // Fall back to a Minor so the offer slot isn't empty.
      const minor =
        MINOR_ARCANA[Math.floor(rng() * MINOR_ARCANA.length)]!;
      result.push({ kind: "minor", minor });
      continue;
    }
    const arcana = pool[Math.floor(rng() * pool.length)]!;
    usedMajorIds.add(arcana.id);
    result.push({ kind: "major", arcana });
  }
  return result;
}

/** Price of a Parlour offer, dispatched by kind. */
export function priceOf(offer: ParlourOffer): number {
  return offer.kind === "major" ? ARCANA_PRICE : MINOR_PRICE;
}
