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

export const LEVELS: readonly Level[] = [
  {
    id: 1,
    numeral: "I",
    name: "The Magician",
    epigraph: "Begin with a single intent.",
    objective: { type: "score", target: 800 },
    moves: 20,
    stars: { one: 800, two: 1200, three: 1800 },
  },
  {
    id: 2,
    numeral: "II",
    name: "The High Priestess",
    epigraph: "Listen for the water.",
    objective: { type: "suit", target: 14, suit: "cups" },
    moves: 22,
    stars: { one: 1000, two: 1500, three: 2200 },
  },
  {
    id: 3,
    numeral: "III",
    name: "The Empress",
    epigraph: "Abundance asks for nothing.",
    objective: { type: "score", target: 1500 },
    moves: 22,
    stars: { one: 1500, two: 2200, three: 3000 },
  },
  {
    id: 4,
    numeral: "IV",
    name: "The Emperor",
    epigraph: "Order before sentiment.",
    objective: { type: "suit", target: 14, suit: "swords" },
    moves: 20,
    stars: { one: 1400, two: 2100, three: 3000 },
  },
  {
    id: 5,
    numeral: "V",
    name: "The Hierophant",
    epigraph: "The same wisdom, told twice.",
    objective: { type: "score", target: 2200 },
    moves: 22,
    stars: { one: 2200, two: 3000, three: 4000 },
  },
  {
    id: 6,
    numeral: "VI",
    name: "The Lovers",
    epigraph: "Two suits, one decision.",
    objective: { type: "suit", target: 18, suit: "pentacles" },
    moves: 24,
    stars: { one: 1800, two: 2700, three: 3600 },
  },
  {
    id: 7,
    numeral: "VII",
    name: "The Chariot",
    epigraph: "Press the advantage.",
    objective: { type: "score", target: 3200 },
    moves: 20,
    stars: { one: 3200, two: 4200, three: 5500 },
  },
  {
    id: 8,
    numeral: "VIII",
    name: "Strength",
    epigraph: "Pace the long task.",
    objective: { type: "suit", target: 22, suit: "wands" },
    moves: 28,
    stars: { one: 2400, two: 3500, three: 4800 },
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
