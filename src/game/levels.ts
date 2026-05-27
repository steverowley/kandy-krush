import type { Suit } from "./engine/types";

export type Objective =
  | { type: "score"; target: number }
  | { type: "suit"; target: number; suit: Suit };

export type Level = {
  id: number;
  numeral: string;
  name: string;
  epigraph: string;
  objective: Objective;
  moves: number;
  /** Score thresholds for one / two / three stars. The "target" of the
   *  objective decides win-vs-loss; stars are always a score read. */
  stars: { one: number; two: number; three: number };
};

// Score thresholds tuned for the Chips × Mult engine (PR #376). Average
// play scores ~2.5× a single-3-match floor under the new math, so every
// score-typed target and star threshold has been multiplied by ~2.5
// (rounded to the nearest hundred). Suit-clear targets carry over —
// those are cleared-cell counts, unchanged by the scoring refactor.
export const LEVELS: readonly Level[] = [
  {
    id: 1,
    numeral: "I",
    name: "The Magician",
    epigraph: "Begin with a single intent.",
    objective: { type: "score", target: 2000 },
    moves: 20,
    stars: { one: 2000, two: 3000, three: 4500 },
  },
  {
    id: 2,
    numeral: "II",
    name: "The High Priestess",
    epigraph: "Listen for the water.",
    objective: { type: "suit", target: 14, suit: "cups" },
    moves: 22,
    stars: { one: 2500, two: 3800, three: 5500 },
  },
  {
    id: 3,
    numeral: "III",
    name: "The Empress",
    epigraph: "Abundance asks for nothing.",
    objective: { type: "score", target: 3800 },
    moves: 22,
    stars: { one: 3800, two: 5500, three: 7500 },
  },
  {
    id: 4,
    numeral: "IV",
    name: "The Emperor",
    epigraph: "Order before sentiment.",
    objective: { type: "suit", target: 14, suit: "swords" },
    moves: 20,
    stars: { one: 3500, two: 5300, three: 7500 },
  },
  {
    id: 5,
    numeral: "V",
    name: "The Hierophant",
    epigraph: "The same wisdom, told twice.",
    objective: { type: "score", target: 5500 },
    moves: 22,
    stars: { one: 5500, two: 7500, three: 10000 },
  },
  {
    id: 6,
    numeral: "VI",
    name: "The Lovers",
    epigraph: "Two suits, one decision.",
    objective: { type: "suit", target: 18, suit: "pentacles" },
    moves: 24,
    stars: { one: 4500, two: 6800, three: 9000 },
  },
  {
    id: 7,
    numeral: "VII",
    name: "The Chariot",
    epigraph: "Press the advantage.",
    objective: { type: "score", target: 8000 },
    moves: 20,
    stars: { one: 8000, two: 10500, three: 13800 },
  },
  {
    id: 8,
    numeral: "VIII",
    name: "Strength",
    epigraph: "Pace the long task.",
    objective: { type: "suit", target: 22, suit: "wands" },
    moves: 28,
    stars: { one: 6000, two: 8800, three: 12000 },
  },
  {
    id: 9,
    numeral: "IX",
    name: "The Hermit",
    epigraph: "One lantern, one step.",
    objective: { type: "score", target: 9500 },
    moves: 24,
    stars: { one: 9500, two: 12500, three: 16300 },
  },
  {
    id: 10,
    numeral: "X",
    name: "Wheel of Fortune",
    epigraph: "The cloth turns under your hand.",
    objective: { type: "suit", target: 24, suit: "cups" },
    moves: 26,
    stars: { one: 7000, two: 10000, three: 13800 },
  },
  {
    id: 11,
    numeral: "XI",
    name: "Justice",
    epigraph: "Weigh each card honestly.",
    objective: { type: "suit", target: 24, suit: "pentacles" },
    moves: 24,
    stars: { one: 7500, two: 11000, three: 15000 },
  },
  {
    id: 12,
    numeral: "XII",
    name: "The Hanged Man",
    epigraph: "Look once more, from below.",
    objective: { type: "score", target: 13800 },
    moves: 26,
    stars: { one: 13800, two: 18800, three: 25000 },
  },
];

export function levelById(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function starCount(level: Level, score: number, objectiveMet: boolean): 0 | 1 | 2 | 3 {
  if (!objectiveMet) return 0;
  if (score >= level.stars.three) return 3;
  if (score >= level.stars.two) return 2;
  if (score >= level.stars.one) return 1;
  return 1; // hit target = at least one star even if score-floor under-shot
}

export function objectiveProgress(
  objective: Objective,
  score: number,
  cleared: Record<Suit, number>,
): { value: number; target: number; met: boolean; label: string } {
  if (objective.type === "score") {
    return {
      value: Math.min(score, objective.target),
      target: objective.target,
      met: score >= objective.target,
      label: `Fortune — ${objective.target.toLocaleString()}`,
    };
  }
  const value = cleared[objective.suit] ?? 0;
  return {
    value: Math.min(value, objective.target),
    target: objective.target,
    met: value >= objective.target,
    label: `Clear ${objective.target} of ${suitLabel(objective.suit)}`,
  };
}

function suitLabel(suit: Suit): string {
  return suit.charAt(0).toUpperCase() + suit.slice(1);
}
