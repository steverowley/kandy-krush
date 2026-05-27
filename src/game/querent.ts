import type { Objective } from "./levels";
import type { Suit } from "./engine/types";
import type { Stake } from "./stakes";

/**
 * Boss Blind rule restriction — modifies how a single chamber scores or
 * objectives are evaluated. Per the design brief §4.4. Three effect
 * shapes are supported today; future restrictions can mix-and-match.
 */
export type ChamberRestriction = {
  id: string;
  /** Short uppercase chip the player sees in the HUD ("WANDS SILENT"). */
  name: string;
  /** One-line explanation shown on the chamber card and Play HUD. */
  description: string;
  /** Italic Spanish flavor for the card footer. */
  flavor: string;
  /** If set, matches of this suit clear the board but score nothing. */
  silenceSuit?: Suit;
  /** If true, Arcana-effect deltas (chips + mult bonuses) are halved. */
  halveArcana?: boolean;
  /** Multiplier applied to the chamber's score objective target. */
  targetMultiplier?: number;
};

export type QuerentClass = {
  id: "seer" | "maker" | "walker";
  numeral: string;
  name: string;
  panelName: string;
  panelCaption: string;
  body: string;
  subtitle: string;
  panelColor: string;
  /** Added to every chamber's move budget. */
  moveBonus: number;
  /** Multiplier applied to all score gained during the run. 1.0 = none. */
  scoreMultiplier: number;
};

export const CLASSES: readonly QuerentClass[] = [
  {
    id: "seer",
    numeral: "·I·",
    name: "The Seer",
    panelName: "Seer",
    panelCaption: "una mirada paciente",
    body: "Every chamber grants two extra readings. Linger in the spread.",
    subtitle: "la vidente · +2 readings per chamber",
    panelColor: "var(--panel-amethyst)",
    moveBonus: 2,
    scoreMultiplier: 1.0,
  },
  {
    id: "maker",
    numeral: "·II·",
    name: "The Maker",
    panelName: "Maker",
    panelCaption: "manos consecuentes",
    body: "All fortune is multiplied by a quarter. Trust your hand.",
    subtitle: "el hacedor · +25% fortune",
    panelColor: "var(--panel-coral)",
    moveBonus: 0,
    scoreMultiplier: 1.25,
  },
  {
    id: "walker",
    numeral: "·III·",
    name: "The Walker",
    panelName: "Walker",
    panelCaption: "el camino largo",
    body: "One extra reading per chamber, a slight fortune lift, no protection.",
    subtitle: "el caminante · +1 reading, +10% fortune",
    panelColor: "var(--panel-emerald)",
    moveBonus: 1,
    scoreMultiplier: 1.1,
  },
];

export function classById(id: string): QuerentClass | undefined {
  return CLASSES.find((c) => c.id === id);
}

export type Chamber = {
  index: number; // 1-based
  numeral: string;
  name: string;
  epigraph: string;
  subtitle: string;
  objective: Objective;
  baseMoves: number;
  panelColor: string;
  boss: boolean;
  restriction?: ChamberRestriction;
};

// Score-typed targets recalibrated for the Chips × Mult engine (PR #376):
// multiplied by ~2.5× to match average per-move score scaling under the
// new math. Suit-typed targets carry over — cleared-cell counts are
// unaffected by the scoring refactor.
export const CHAMBERS: readonly Chamber[] = [
  {
    index: 1,
    numeral: "IX",
    name: "The Hermit",
    epigraph: "una vela",
    subtitle: "el ermitaño · light a single candle",
    objective: { type: "score", target: 1500 },
    baseMoves: 12,
    panelColor: "var(--panel-cobalt)",
    boss: false,
  },
  {
    index: 2,
    numeral: "X",
    name: "Wheel of Fortune",
    epigraph: "la rueda gira",
    subtitle: "la rueda · the cycle turns either way",
    objective: { type: "score", target: 2300 },
    baseMoves: 12,
    panelColor: "var(--panel-saffron)",
    boss: false,
  },
  {
    index: 3,
    numeral: "XI",
    name: "Justice",
    epigraph: "balanza",
    subtitle: "la justicia · an even weighing",
    objective: { type: "suit", target: 8, suit: "pentacles" },
    baseMoves: 12,
    panelColor: "var(--panel-teal)",
    boss: false,
  },
  {
    index: 4,
    numeral: "XII",
    name: "The Hanged Man",
    epigraph: "rendición",
    subtitle: "el colgado · surrender, then resolve",
    objective: { type: "score", target: 4500 },
    baseMoves: 18,
    panelColor: "var(--panel-amethyst)",
    boss: true,
    restriction: {
      id: "wands-silent",
      name: "Wands Silent",
      description: "Wand matches still clear, but they score no fortune.",
      flavor: "el ahorcado · the suspended fire",
      silenceSuit: "wands",
    },
  },
  {
    index: 5,
    numeral: "XIII",
    name: "Death",
    epigraph: "patrones rotos",
    subtitle: "la muerte · old patterns cut",
    objective: { type: "suit", target: 12, suit: "swords" },
    baseMoves: 14,
    panelColor: "var(--panel-coral)",
    boss: false,
  },
  {
    index: 6,
    numeral: "XIV",
    name: "Temperance",
    epigraph: "una mezcla",
    subtitle: "la templanza · a measured pour",
    objective: { type: "score", target: 5000 },
    baseMoves: 16,
    panelColor: "var(--panel-emerald)",
    boss: false,
  },
  {
    index: 7,
    numeral: "XV",
    name: "The Devil",
    epigraph: "un pequeño pacto",
    subtitle: "el diablo · a small bargain made plain",
    objective: { type: "score", target: 7500 },
    baseMoves: 20,
    panelColor: "var(--panel-pink)",
    boss: true,
    restriction: {
      id: "arcana-halved",
      name: "Arcana Halved",
      description: "Every held Arcana contributes only half its usual chips and mult.",
      flavor: "el diablo · the bargain trims the gift",
      halveArcana: true,
    },
  },
  {
    index: 8,
    numeral: "XVI",
    name: "The Tower",
    epigraph: "todo cae",
    subtitle: "la torre · everything that needed to fall",
    objective: { type: "suit", target: 14, suit: "wands" },
    baseMoves: 16,
    panelColor: "var(--panel-gold)",
    boss: false,
  },
  {
    index: 9,
    numeral: "XVII",
    name: "The Star",
    epigraph: "luz quieta",
    subtitle: "la estrella · quiet light after the wreck",
    objective: { type: "score", target: 11300 },
    baseMoves: 22,
    panelColor: "var(--panel-cobalt)",
    boss: true,
    restriction: {
      id: "higher-fortune",
      name: "Higher Fortune",
      description: "The fortune target is one and a half times what it asks.",
      flavor: "la estrella · the light demands more",
      targetMultiplier: 1.5,
    },
  },
  {
    index: 10,
    numeral: "XVIII",
    name: "The Moon",
    epigraph: "marea baja",
    subtitle: "la luna · what the tide left behind",
    objective: { type: "suit", target: 14, suit: "cups" },
    baseMoves: 18,
    panelColor: "var(--panel-amethyst)",
    boss: false,
  },
  {
    index: 11,
    numeral: "XIX",
    name: "The Sun",
    epigraph: "todo visible",
    subtitle: "el sol · everything plain at noon",
    objective: { type: "score", target: 10000 },
    baseMoves: 20,
    panelColor: "var(--panel-saffron)",
    boss: false,
  },
  {
    index: 12,
    numeral: "XX",
    name: "Judgement",
    epigraph: "una llamada",
    subtitle: "el juicio · the call you cannot un-hear",
    objective: { type: "suit", target: 16, suit: "swords" },
    baseMoves: 20,
    panelColor: "var(--panel-gold)",
    boss: true,
    restriction: {
      id: "pentacles-silent",
      name: "Pentacles Silent",
      description: "Pentacle matches still clear, but they score no fortune.",
      flavor: "el juicio · the coin is judged void",
      silenceSuit: "pentacles",
    },
  },
  {
    index: 13,
    numeral: "XXI",
    name: "The World",
    epigraph: "el círculo se cierra",
    subtitle: "el mundo · the circle, complete",
    objective: { type: "score", target: 16300 },
    baseMoves: 24,
    panelColor: "var(--panel-emerald)",
    boss: true,
    restriction: {
      id: "twice-the-weight",
      name: "Twice the Weight",
      description: "The fortune target doubles. The final circle takes everything.",
      flavor: "el mundo · the world doubles its ask",
      targetMultiplier: 2,
    },
  },
];

export const CHAMBER_COUNT = CHAMBERS.length;

export function chamberByIndex(idx: number): Chamber | undefined {
  return CHAMBERS.find((c) => c.index === idx);
}

export function chamberMovesFor(
  chamber: Chamber,
  klass: QuerentClass,
  stake?: Stake | null,
): number {
  const stakeDelta = stake?.moveDelta ?? 0;
  return Math.max(1, chamber.baseMoves + klass.moveBonus + stakeDelta);
}

/**
 * Apply a chamber's restriction AND the run's active Stake to its
 * objective. Stake multiplier stacks on top of any boss-restriction
 * multiplier; suit-clear targets are unaffected by either layer.
 */
export function chamberEffectiveObjective(
  chamber: Chamber,
  stake?: Stake | null,
): Objective {
  if (chamber.objective.type !== "score") return chamber.objective;
  const restrictionMult = chamber.restriction?.targetMultiplier ?? 1;
  const stakeMult = stake?.targetMultiplier ?? 1;
  const combined = restrictionMult * stakeMult;
  if (combined === 1) return chamber.objective;
  return {
    ...chamber.objective,
    target: Math.round(chamber.objective.target * combined),
  };
}
