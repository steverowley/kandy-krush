/**
 * Stakes — Balatro / Slay-the-Spire-style difficulty tiers. Each
 * completed run at the player's current max-stake unlocks the next.
 * Modifiers stack within a tier (i.e. each tier is harder than the
 * previous by a small step).
 *
 * Stake #0 is the baseline ("White"). Each subsequent stake nudges
 * the chamber score targets up and the move budgets down. Future tiers
 * can layer qualitative restrictions (smaller arcana draws, smaller
 * hand caps, no minor rewards) — for now every tier is a pair of
 * numerical screws.
 */

export type StakeId =
  | "white"
  | "red"
  | "green"
  | "black"
  | "blue"
  | "purple"
  | "orange"
  | "gold";

export type Stake = {
  id: StakeId;
  /** 0-based tier index. White = 0, Gold = 7. */
  tier: number;
  /** Display name shown on the lobby chip. */
  name: string;
  /** Italic Spanish flavor for the chip tooltip. */
  flavor: string;
  /** Multiplier applied to every chamber's score objective target. */
  targetMultiplier: number;
  /** Delta applied to every chamber's move budget (negative = harder). */
  moveDelta: number;
  /** CSS color token used for the chip accent on the lobby. */
  panelColor: string;
};

export const STAKES: readonly Stake[] = [
  {
    id: "white",
    tier: 0,
    name: "White",
    flavor: "la apuesta blanca · the baseline reading",
    targetMultiplier: 1.0,
    moveDelta: 0,
    panelColor: "var(--bone-100)",
  },
  {
    id: "red",
    tier: 1,
    name: "Red",
    flavor: "la apuesta roja · the cloth tightens",
    targetMultiplier: 1.1,
    moveDelta: -1,
    panelColor: "var(--panel-coral)",
  },
  {
    id: "green",
    tier: 2,
    name: "Green",
    flavor: "la apuesta verde · the path narrows",
    targetMultiplier: 1.2,
    moveDelta: -2,
    panelColor: "var(--panel-emerald)",
  },
  {
    id: "black",
    tier: 3,
    name: "Black",
    flavor: "la apuesta negra · the reading deepens",
    targetMultiplier: 1.35,
    moveDelta: -2,
    panelColor: "var(--ink-strong)",
  },
  {
    id: "blue",
    tier: 4,
    name: "Blue",
    flavor: "la apuesta azul · the tide rises",
    targetMultiplier: 1.5,
    moveDelta: -3,
    panelColor: "var(--panel-cobalt)",
  },
  {
    id: "purple",
    tier: 5,
    name: "Purple",
    flavor: "la apuesta púrpura · the cards weigh more",
    targetMultiplier: 1.65,
    moveDelta: -3,
    panelColor: "var(--panel-amethyst)",
  },
  {
    id: "orange",
    tier: 6,
    name: "Orange",
    flavor: "la apuesta naranja · the candle burns short",
    targetMultiplier: 1.85,
    moveDelta: -4,
    panelColor: "var(--panel-saffron)",
  },
  {
    id: "gold",
    tier: 7,
    name: "Gold",
    flavor: "la apuesta dorada · the final weight",
    targetMultiplier: 2.1,
    moveDelta: -4,
    panelColor: "var(--accent-gold)",
  },
];

export const STAKE_COUNT = STAKES.length;
export const DEFAULT_STAKE: StakeId = "white";

export function stakeById(id: StakeId): Stake | undefined {
  return STAKES.find((s) => s.id === id);
}

export function stakeByTier(tier: number): Stake | undefined {
  return STAKES.find((s) => s.tier === tier);
}

/** Next stake to unlock after winning at `current`. Returns null if
 *  Gold (the highest tier) has already been beaten. */
export function nextStakeAfter(current: StakeId): Stake | null {
  const cur = stakeById(current);
  if (!cur) return null;
  return stakeByTier(cur.tier + 1) ?? null;
}
