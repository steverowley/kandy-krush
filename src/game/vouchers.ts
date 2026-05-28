/**
 * Vouchers — permanent run-scoped upgrades sold at the Parlour. Unlike
 * Major Arcana (slot-bound, scored each move) and Minor Arcana
 * (consumables), a Voucher's effect is ambient and persistent: once
 * bought it modifies the run's coin / cap / reroll economy until the
 * run ends. Reset on every run boundary in useVouchers.
 *
 * Brief §4.7 — Parlour v2.
 */

export type VoucherId =
  | "heavy-purse"
  | "sixth-slot"
  | "mystic-mirror"
  | "deeper-cup";

export type VoucherEffect = {
  /** Bonus coins added to every chamber-win grant. */
  coinBonus?: number;
  /** Bonus added to the effective Major Arcana hand cap. */
  handCapBonus?: number;
  /** Bonus added to the effective Minor Arcana hand cap. */
  minorCapBonus?: number;
  /** Free Parlour rerolls granted per visit. */
  freeRerolls?: number;
};

export type Voucher = {
  id: VoucherId;
  name: string;
  /** Plain-English effect description rendered on the offer card. */
  description: string;
  /** Italic Spanish flavor for the card footer. */
  flavor: string;
  /** Coin price. */
  price: number;
  /** Card panel accent token. */
  panelColor: string;
  effect: VoucherEffect;
};

export const VOUCHERS: readonly Voucher[] = [
  {
    id: "heavy-purse",
    name: "Heavy Purse",
    description: "+2 coins each time you clear a chamber.",
    flavor: "el bolsillo pesado · the purse keeps its weight",
    price: 8,
    panelColor: "var(--panel-gold)",
    effect: { coinBonus: 2 },
  },
  {
    id: "sixth-slot",
    name: "Sixth Slot",
    description: "Your Arcana hand cap rises by one.",
    flavor: "la sexta silla · room for one more reading",
    price: 12,
    panelColor: "var(--panel-amethyst)",
    effect: { handCapBonus: 1 },
  },
  {
    id: "mystic-mirror",
    name: "Mystic Mirror",
    description: "One free Parlour reroll per visit, on the house.",
    flavor: "el espejo místico · the second look",
    price: 10,
    panelColor: "var(--panel-cobalt)",
    effect: { freeRerolls: 1 },
  },
  {
    id: "deeper-cup",
    name: "Deeper Cup",
    description: "Your Minor Arcana tray gains one slot.",
    flavor: "la copa profunda · room for one more sip",
    price: 8,
    panelColor: "var(--panel-emerald)",
    effect: { minorCapBonus: 1 },
  },
];

export function voucherById(id: VoucherId): Voucher | undefined {
  return VOUCHERS.find((v) => v.id === id);
}

/**
 * Sum every voucher's contribution into one flat effect record. Reads
 * once at use-site, so callers don't repeatedly iterate the owned list.
 */
export function aggregateVoucherEffects(
  owned: readonly Voucher[],
): Required<VoucherEffect> {
  const totals: Required<VoucherEffect> = {
    coinBonus: 0,
    handCapBonus: 0,
    minorCapBonus: 0,
    freeRerolls: 0,
  };
  for (const v of owned) {
    totals.coinBonus += v.effect.coinBonus ?? 0;
    totals.handCapBonus += v.effect.handCapBonus ?? 0;
    totals.minorCapBonus += v.effect.minorCapBonus ?? 0;
    totals.freeRerolls += v.effect.freeRerolls ?? 0;
  }
  return totals;
}
