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

export type MinorArcanaId = "page-pentacles" | "page-cups" | "page-wands";

/** Effect shapes a consumable can fire. Strict union keeps Play.tsx
 *  dispatch exhaustive at compile time. */
export type MinorEffect =
  | { kind: "add-moves"; amount: number }
  | { kind: "add-score"; amount: number }
  | { kind: "double-next-move" };

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
    effect: { kind: "double-next-move" },
  },
];

export function minorById(id: MinorArcanaId): MinorArcana | undefined {
  return MINOR_ARCANA.find((m) => m.id === id);
}

/** Maximum simultaneously-held Minors. Smaller than Major's 5 because
 *  Minors are powerful one-shots. */
export const MAX_HELD_MINORS = 3;
