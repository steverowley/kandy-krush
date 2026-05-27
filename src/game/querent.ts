import type { Objective } from "./levels";

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
};

export const CHAMBERS: readonly Chamber[] = [
  {
    index: 1,
    numeral: "IX",
    name: "The Hermit",
    epigraph: "una vela",
    subtitle: "el ermitaño · light a single candle",
    objective: { type: "score", target: 600 },
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
    objective: { type: "score", target: 900 },
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
    objective: { type: "score", target: 1800 },
    baseMoves: 18,
    panelColor: "var(--panel-amethyst)",
    boss: true,
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
    objective: { type: "score", target: 2000 },
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
    objective: { type: "score", target: 3000 },
    baseMoves: 20,
    panelColor: "var(--panel-pink)",
    boss: true,
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
    objective: { type: "score", target: 4500 },
    baseMoves: 22,
    panelColor: "var(--panel-cobalt)",
    boss: true,
  },
];

export const CHAMBER_COUNT = CHAMBERS.length;

export function chamberByIndex(idx: number): Chamber | undefined {
  return CHAMBERS.find((c) => c.index === idx);
}

export function chamberMovesFor(chamber: Chamber, klass: QuerentClass): number {
  return chamber.baseMoves + klass.moveBonus;
}
