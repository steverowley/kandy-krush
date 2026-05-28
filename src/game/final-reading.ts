/**
 * The Fool's Journey — hidden Act IV endgame per brief §4.5.
 *
 * Three escalating chambers gated behind three Keys of the Querent
 * (earned during regular play) plus at least one completed run. The
 * final chamber is The World fighting back — the brief's "true ending."
 * No standard rewards land here: no Parlour visits, no Arcana Draws
 * between chambers, no Boss-Minor grants. The reward is the unlock.
 */

import type { ChamberRestriction } from "./querent";

/** The three kinds of Keys players can collect during regular play. All
 *  three must be `true` for the Final Reading to unlock. */
export type KeyKind = "boss" | "daily" | "spread";

/** Score threshold (relative to a chamber's effective objective) that
 *  qualifies as "3-star pace" for the boss-pace key. */
export const BOSS_PACE_RATIO = 1.5;

/** Score threshold for the daily-fortune key. */
export const DAILY_FORTUNE_THRESHOLD = 5000;

export type FinalChamber = {
  /** 1-based; the Final Reading is always 3 chambers. */
  index: 1 | 2 | 3;
  numeral: string;
  name: string;
  epigraph: string;
  panelColor: string;
  /** Score target. The Final Reading is score-only — no suit objectives. */
  target: number;
  /** Move budget. */
  moves: number;
  /** Restriction layered on the chamber. Reuses the standard
   *  ChamberRestriction shape so the engine path is the same. */
  restriction: ChamberRestriction;
};

export const FINAL_CHAMBERS: readonly FinalChamber[] = [
  {
    index: 1,
    numeral: "·I·",
    name: "The Shadow",
    epigraph: "your reflection sharpens",
    panelColor: "var(--panel-amethyst)",
    target: 25000,
    moves: 18,
    restriction: {
      id: "shadow-rule",
      name: "Shadow Rule",
      description: "Swords score nothing. A tile is destroyed every fourth reading.",
      flavor: "el espejo · the reflection cuts both ways",
      silenceSuit: "swords",
      destroyEveryN: 4,
    },
  },
  {
    index: 2,
    numeral: "·II·",
    name: "The Dealer",
    epigraph: "the cards refuse to settle",
    panelColor: "var(--panel-coral)",
    target: 35000,
    moves: 18,
    restriction: {
      id: "dealer-rule",
      name: "Wild Dealer",
      description: "No specials may be planted; Arcana contribute half.",
      flavor: "el repartidor · without the cascade's safety",
      blockSpecialPromotions: true,
      halveArcana: true,
    },
  },
  {
    index: 3,
    numeral: "·XXI·",
    name: "The World",
    epigraph: "the circle, complete",
    panelColor: "var(--accent-gold)",
    target: 50000,
    moves: 22,
    restriction: {
      id: "world-rule",
      name: "The Final Weight",
      description:
        "Targets carry a half-again weight; the board plants no specials.",
      flavor: "el mundo · all the readings are this one",
      targetMultiplier: 1.5,
      blockSpecialPromotions: true,
    },
  },
];

export const FINAL_CHAMBER_COUNT = FINAL_CHAMBERS.length;

export function finalChamberByIndex(idx: number): FinalChamber | undefined {
  return FINAL_CHAMBERS.find((c) => c.index === idx);
}
