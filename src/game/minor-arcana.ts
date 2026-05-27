/**
 * Minor Arcana — Balatro-style consumable deck-edits.
 *
 * Unlike Major Arcana (held slot, fires every scoring step), Minors are
 * one-shot: the player taps a consumable in the Play HUD and it fires
 * its effect immediately, then leaves the hand. Brief §4.3.
 *
 * Effects are a discriminated union so the data layer stays declarative
 * — the Play screen dispatches on `effect.kind`. New effect shapes can
 * be added without touching the Minors themselves.
 */

export type MinorArcanaId =
  | "page-pentacles"
  | "page-cups"
  | "page-wands"
  | "knight-cups"
  | "knight-pentacles"
  | "knight-wands"
  | "queen-wands"
  | "king-pentacles";

/** Effect shapes a consumable can fire. Strict union keeps Play.tsx
 *  dispatch exhaustive at compile time. */
export type MinorEffect =
  | { kind: "add-moves"; amount: number }
  | { kind: "add-score"; amount: number }
  /** Multiply the next scored move's total score. Page of Wands = 2,
   *  Knight of Wands = 3. */
  | { kind: "next-move-score-mul"; multiplier: number }
  /** Multiply the next scored move's mult (independent of score-mul). */
  | { kind: "next-move-mult-mul"; multiplier: number }
  /** Add a flat chips bonus to the next scored move, scaled per cell
   *  on the board (e.g. King of Pentacles: +5 chips per cell). */
  | { kind: "next-move-chips-per-cell"; perCell: number };

export type MinorArcana = {
  id: MinorArcanaId;
  numeral: string;
  name: string;
  description: string;
  /** Italic Spanish flavor for the badge tooltip. */
  flavor: string;
  /** Per-card accent color — reuses a `--panel-*` token. */
  panelColor: string;
  effect: MinorEffect;
};

export const MINOR_ARCANA: readonly MinorArcana[] = [
  {
    id: "page-pentacles",
    numeral: "P · ☉",
    name: "Page of Pentacles",
    description: "Three more readings to spend this chamber.",
    flavor: "el paje de oros · the coin loans time",
    panelColor: "var(--panel-gold)",
    effect: { kind: "add-moves", amount: 3 },
  },
  {
    id: "page-cups",
    numeral: "P · ♥",
    name: "Page of Cups",
    description: "Fifteen hundred fortune, poured straight in.",
    flavor: "el paje de copas · the cup brims over",
    panelColor: "var(--panel-cobalt)",
    effect: { kind: "add-score", amount: 1500 },
  },
  {
    id: "page-wands",
    numeral: "P · ♦",
    name: "Page of Wands",
    description: "The very next move scores doubled.",
    flavor: "el paje de bastos · the spark catches twice",
    panelColor: "var(--panel-coral)",
    effect: { kind: "next-move-score-mul", multiplier: 2 },
  },
  {
    id: "knight-cups",
    numeral: "C · ♥",
    name: "Knight of Cups",
    description: "Two more readings, poured into the cup.",
    flavor: "el caballo de copas · the cup carried at gallop",
    panelColor: "var(--panel-cobalt)",
    effect: { kind: "add-moves", amount: 2 },
  },
  {
    id: "knight-pentacles",
    numeral: "C · ☉",
    name: "Knight of Pentacles",
    description: "Three thousand fortune, charged into the ledger.",
    flavor: "el caballo de oros · the coin galloped in",
    panelColor: "var(--panel-gold)",
    effect: { kind: "add-score", amount: 3000 },
  },
  {
    id: "knight-wands",
    numeral: "C · ♦",
    name: "Knight of Wands",
    description: "The very next move scores tripled.",
    flavor: "el caballo de bastos · the spark trebles",
    panelColor: "var(--panel-coral)",
    effect: { kind: "next-move-score-mul", multiplier: 3 },
  },
  {
    id: "queen-wands",
    numeral: "Q · ♦",
    name: "Queen of Wands",
    description: "The very next move's mult is tripled.",
    flavor: "la reina de bastos · the flame triples",
    panelColor: "var(--panel-coral)",
    effect: { kind: "next-move-mult-mul", multiplier: 3 },
  },
  {
    id: "king-pentacles",
    numeral: "K · ☉",
    name: "King of Pentacles",
    description: "Every cell on the board is worth +5 chips for the next move.",
    flavor: "el rey de oros · the kingdom pays per stone",
    panelColor: "var(--panel-gold)",
    effect: { kind: "next-move-chips-per-cell", perCell: 5 },
  },
];

export function minorById(id: MinorArcanaId): MinorArcana | undefined {
  return MINOR_ARCANA.find((m) => m.id === id);
}

/** Maximum simultaneously-held Minors. Smaller than Major's 5 because
 *  Minors are powerful one-shots. */
export const MAX_HELD_MINORS = 3;
