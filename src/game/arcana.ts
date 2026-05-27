/**
 * Major Arcana — Balatro-style "Jokers" for Arcana Cascada.
 *
 * Each Arcana modifies the Chips × Mult scoring formula via a single
 * `apply(ctx)` function that mutates a per-step scoring context. Effects
 * fire **left-to-right** in the order the player drafted them, so deck
 * order matters (just like Balatro joker order).
 *
 * This first batch of five lays the foundation. More arcana can be added
 * to MAJOR_ARCANA without touching the application code.
 */

import type { Board, CascadeStep, Cell, MatchGroup } from "./engine/types";
import type { Suit } from "./engine/types";

/** Per-cell chip value — must match cascade.ts CHIPS_PER_CELL. */
const CHIPS_PER_CELL = 10;

function matchSizeBonus(n: number): number {
  if (n >= 6) return 20;
  if (n >= 5) return 8;
  if (n >= 4) return 4;
  return 2;
}

/**
 * Return a copy of `step` with all matches of `silencedSuit` removed
 * and chips/mult adjusted so that suit contributes nothing. The board
 * still cleared those cells (engine already collapsed them) — the
 * change is purely in scoring.
 */
export function silenceSuitInStep(
  step: CascadeStep,
  silencedSuit: Suit,
): CascadeStep {
  let chipsRemoved = 0;
  let multRemoved = 0;
  const kept: MatchGroup[] = [];
  for (const g of step.matches) {
    if (g.suit === silencedSuit) {
      chipsRemoved += g.cells.length * CHIPS_PER_CELL;
      multRemoved += matchSizeBonus(g.cells.length);
    } else {
      kept.push(g);
    }
  }
  return {
    ...step,
    matches: kept,
    chips: Math.max(0, step.chips - chipsRemoved),
    mult: Math.max(0, step.mult - multRemoved),
  };
}

/** Identifier — stable across persistence. */
export type ArcanaId =
  | "fool"
  | "magician"
  | "empress"
  | "hierophant"
  | "lovers"
  | "chariot"
  | "strength"
  | "hermit"
  | "justice"
  | "hanged-man"
  | "death"
  | "temperance"
  | "devil"
  | "tower"
  | "moon"
  | "sun"
  | "world";

export type ArcanaContext = {
  /** Cascade step currently being scored. */
  step: CascadeStep;
  /** Running chips for this step (modifiable). */
  chips: number;
  /** Running mult for this step (modifiable). */
  mult: number;
  /** 1-based depth of the cascade step. */
  depth: number;
  /** How many moves into the current chamber the player is (0-based on
   *  the move that's currently being scored — pre-increment). */
  movesUsed: number;
  /** Total move budget for this chamber, if known. */
  totalMoves: number | null;
  /** How many arcana the player currently holds (including this one).
   *  Used by The Hermit which rewards a thin build. */
  heldCount: number;
  /** Effective hand cap for this run — equal to MAX_HELD_ARCANA on most
   *  stakes, but stake rules can shrink it (e.g. Black caps at 4). The
   *  Hermit's empty-slot bonus reads this so a smaller cap means fewer
   *  "empty" slots to reward. */
  maxHand: number;
  /** How many Minor Arcana the player is currently holding. The Devil
   *  scales with this. */
  minorHeldCount: number;
  /** True when the current chamber is a Boss Blind. Used by The Tower
   *  which doubles down on boss chambers. */
  isBoss: boolean;
};

export type Arcana = {
  id: ArcanaId;
  numeral: string;
  name: string;
  /** Italic Spanish caption shown on the card panel. */
  panelCaption: string;
  /** Plain-English effect description shown in the Draw + Play UI. */
  description: string;
  /** Multilingual subtitle for the card foot. */
  subtitle: string;
  /** Card panel accent color. Reuses an existing `--panel-*` token. */
  panelColor: string;
  /** Modifies the per-step scoring context in place. */
  apply: (ctx: ArcanaContext) => void;
  /** Optional imperative board hook that fires once per move, after the
   *  swap's cascade has settled and scored. Return cells to destroy via
   *  the engine's `destroyCells`; the resulting refill-cascade is folded
   *  into the same move's scoring. */
  postMove?: (board: Board, rng: () => number) => Cell[];
};

export const MAJOR_ARCANA: readonly Arcana[] = [
  {
    id: "fool",
    numeral: "0",
    name: "The Fool",
    panelCaption: "el comienzo",
    description: "First cascade step of every move scores chips × 3.",
    subtitle: "el loco · the first leap is free",
    panelColor: "var(--panel-pink)",
    apply: (ctx) => {
      if (ctx.depth === 1) ctx.chips *= 3;
    },
  },
  {
    id: "magician",
    numeral: "I",
    name: "The Magician",
    panelCaption: "intención",
    description: "+30 chips per Wand cell cleared this step.",
    subtitle: "el mago · intent shapes the flame",
    panelColor: "var(--panel-coral)",
    apply: (ctx) => {
      const wands = countCells(ctx.step, "wands");
      ctx.chips += wands * 30;
    },
  },
  {
    id: "empress",
    numeral: "III",
    name: "The Empress",
    panelCaption: "abundancia",
    description: "+20 chips per Cup cell cleared this step.",
    subtitle: "la emperatriz · the cup overflows",
    panelColor: "var(--panel-emerald)",
    apply: (ctx) => {
      const cups = countCells(ctx.step, "cups");
      ctx.chips += cups * 20;
    },
  },
  {
    id: "hierophant",
    numeral: "V",
    name: "The Hierophant",
    panelCaption: "doctrina",
    description: "Pentacle matches multiply your mult by ×1.25.",
    subtitle: "el hierofante · the rite is written",
    panelColor: "var(--panel-gold)",
    apply: (ctx) => {
      const hasPentacles = ctx.step.matches.some((g) => g.suit === "pentacles");
      if (hasPentacles) ctx.mult = Math.round(ctx.mult * 1.25);
    },
  },
  {
    id: "lovers",
    numeral: "VI",
    name: "The Lovers",
    panelCaption: "unión",
    description: "Cups and Wands matched in the same step: ×1.5 mult.",
    subtitle: "los enamorados · two suits, one fortune",
    panelColor: "var(--panel-pink)",
    apply: (ctx) => {
      const suits = new Set(ctx.step.matches.map((g) => g.suit));
      if (suits.has("cups") && suits.has("wands")) {
        ctx.mult = Math.round(ctx.mult * 1.5);
      }
    },
  },
  {
    id: "chariot",
    numeral: "VII",
    name: "The Chariot",
    panelCaption: "el avance",
    description: "+3 mult for each cascade step (chains grow faster).",
    subtitle: "el carro · momentum gathers",
    panelColor: "var(--panel-amethyst)",
    apply: (ctx) => {
      ctx.mult += ctx.depth * 3;
    },
  },
  {
    id: "strength",
    numeral: "VIII",
    name: "Strength",
    panelCaption: "fuerza",
    description: "+2 mult for every match of size 4 or larger.",
    subtitle: "la fuerza · the long task held",
    panelColor: "var(--panel-saffron)",
    apply: (ctx) => {
      const big = ctx.step.matches.filter((g) => g.cells.length >= 4).length;
      ctx.mult += big * 2;
    },
  },
  {
    id: "hermit",
    numeral: "IX",
    name: "The Hermit",
    panelCaption: "soledad",
    description: "×1.5 mult per empty Arcana slot — solitude rewarded.",
    subtitle: "el ermitaño · few cards, sharp light",
    panelColor: "var(--panel-cobalt)",
    apply: (ctx) => {
      const empty = Math.max(0, ctx.maxHand - ctx.heldCount);
      if (empty <= 0) return;
      const factor = 1 + empty * 0.5;
      ctx.mult = Math.round(ctx.mult * factor);
    },
  },
  {
    id: "justice",
    numeral: "XI",
    name: "Justice",
    panelCaption: "balanza",
    description:
      "When chips ÷ 10 equals mult exactly, mult is multiplied by ×1.5.",
    subtitle: "la justicia · the scales settle",
    panelColor: "var(--panel-cobalt)",
    apply: (ctx) => {
      if (ctx.mult <= 0) return;
      if (Math.round(ctx.chips / 10) === ctx.mult) {
        ctx.mult = Math.round(ctx.mult * 1.5);
      }
    },
  },
  {
    id: "hanged-man",
    numeral: "XII",
    name: "The Hanged Man",
    panelCaption: "pausa",
    description: "+10 chips per reading already taken in this chamber.",
    subtitle: "el colgado · the wait pays out",
    panelColor: "var(--panel-cobalt)",
    apply: (ctx) => {
      ctx.chips += ctx.movesUsed * 10;
    },
  },
  {
    id: "death",
    numeral: "XIII",
    name: "Death",
    panelCaption: "cambio",
    description: "Destroy 1 random tile per move; +1 mult per cell cleared each step.",
    subtitle: "la muerte · the cut multiplies",
    panelColor: "var(--panel-amethyst)",
    apply: (ctx) => {
      const total = ctx.step.matches.reduce((a, g) => a + g.cells.length, 0);
      ctx.mult += total;
    },
    postMove: (board, rng) => {
      // Pick any occupied cell uniformly. The board is always full at
      // rest, so we just hash the rng to a (row, col).
      const row = Math.floor(rng() * board.rows);
      const col = Math.floor(rng() * board.cols);
      return [{ row, col }];
    },
  },
  {
    id: "temperance",
    numeral: "XIV",
    name: "Temperance",
    panelCaption: "templanza",
    description: "First Cup match and first Wand match each score twice.",
    subtitle: "la templanza · the pour is doubled",
    panelColor: "var(--panel-emerald)",
    apply: (ctx) => {
      const firstCup = ctx.step.matches.find((g) => g.suit === "cups");
      const firstWand = ctx.step.matches.find((g) => g.suit === "wands");
      if (firstCup) {
        ctx.chips += firstCup.cells.length * CHIPS_PER_CELL;
        ctx.mult += matchSizeBonus(firstCup.cells.length);
      }
      if (firstWand) {
        ctx.chips += firstWand.cells.length * CHIPS_PER_CELL;
        ctx.mult += matchSizeBonus(firstWand.cells.length);
      }
    },
  },
  {
    id: "devil",
    numeral: "XV",
    name: "The Devil",
    panelCaption: "deseo",
    description: "+50% mult per Minor Arcana held (each minor sharpens the bargain).",
    subtitle: "el diablo · the bargain compounds",
    panelColor: "var(--panel-amethyst)",
    apply: (ctx) => {
      if (ctx.minorHeldCount <= 0) return;
      ctx.mult = Math.round(ctx.mult * (1 + 0.5 * ctx.minorHeldCount));
    },
  },
  {
    id: "tower",
    numeral: "XVI",
    name: "The Tower",
    panelCaption: "ruptura",
    description: "×1.3 mult when facing a Boss Blind.",
    subtitle: "la torre · the fall sharpens the strike",
    panelColor: "var(--panel-coral)",
    apply: (ctx) => {
      if (ctx.isBoss) ctx.mult = Math.round(ctx.mult * 1.3);
    },
  },
  {
    id: "moon",
    numeral: "XVIII",
    name: "The Moon",
    panelCaption: "marea",
    description: "+1 mult per Cup match in the step.",
    subtitle: "la luna · the tide remembers",
    panelColor: "var(--panel-cobalt)",
    apply: (ctx) => {
      const cupMatches = ctx.step.matches.filter((g) => g.suit === "cups").length;
      ctx.mult += cupMatches;
    },
  },
  {
    id: "sun",
    numeral: "XIX",
    name: "The Sun",
    panelCaption: "plenitud",
    description: "+50 chips on the first cascade step; nothing on chains.",
    subtitle: "el sol · noon, before the chain",
    panelColor: "var(--panel-gold)",
    apply: (ctx) => {
      if (ctx.depth === 1) ctx.chips += 50;
    },
  },
  {
    id: "world",
    numeral: "XXI",
    name: "The World",
    panelCaption: "el círculo",
    description: "×1.25 mult once the chamber's move budget is half spent.",
    subtitle: "el mundo · the circle closing",
    panelColor: "var(--panel-emerald)",
    apply: (ctx) => {
      if (ctx.totalMoves === null) return;
      const halfway = ctx.movesUsed * 2 >= ctx.totalMoves;
      if (halfway) ctx.mult = Math.round(ctx.mult * 1.25);
    },
  },
];

export function arcanaById(id: ArcanaId): Arcana | undefined {
  return MAJOR_ARCANA.find((a) => a.id === id);
}

/** Maximum simultaneously-held arcana per the brief (§4.3). */
export const MAX_HELD_ARCANA = 5;

/**
 * Apply a sequence of arcana to one cascade step. Effects fire in the
 * held order — left to right — so drafting order matters.
 *
 * If `halveArcana` is set (Boss Blind effect), the *delta* contributed
 * by arcana — i.e. the chips/mult added on top of the engine-emitted
 * base — is reduced by 50%.
 */
export function applyArcanaToStep(
  step: CascadeStep,
  held: readonly Arcana[],
  meta: {
    depth: number;
    movesUsed: number;
    totalMoves: number | null;
    halveArcana?: boolean;
    isBoss?: boolean;
    maxHand?: number;
    minorHeldCount?: number;
  },
): { chips: number; mult: number; scoreGained: number } {
  const baseChips = step.chips;
  const baseMult = step.mult;
  const ctx: ArcanaContext = {
    step,
    chips: baseChips,
    mult: baseMult,
    depth: meta.depth,
    movesUsed: meta.movesUsed,
    totalMoves: meta.totalMoves,
    heldCount: held.length,
    maxHand: meta.maxHand ?? MAX_HELD_ARCANA,
    minorHeldCount: meta.minorHeldCount ?? 0,
    isBoss: meta.isBoss ?? false,
  };
  for (const a of held) a.apply(ctx);
  let finalChips = ctx.chips;
  let finalMult = ctx.mult;
  if (meta.halveArcana) {
    const chipsDelta = finalChips - baseChips;
    const multDelta = finalMult - baseMult;
    finalChips = baseChips + Math.round(chipsDelta * 0.5);
    finalMult = baseMult + Math.round(multDelta * 0.5);
  }
  return {
    chips: finalChips,
    mult: finalMult,
    scoreGained: finalChips * finalMult,
  };
}

function countCells(step: CascadeStep, suit: Suit): number {
  let n = 0;
  for (const g of step.matches) {
    if (g.suit === suit) n += g.cells.length;
  }
  return n;
}

/**
 * Draw 3 random Arcana from the pool, excluding any already held. Uses
 * the supplied PRNG so draws can be made deterministic when seeded.
 */
export function rollDraw(
  pool: readonly Arcana[],
  held: readonly Arcana[],
  rng: () => number,
  count = 3,
): Arcana[] {
  const heldIds = new Set(held.map((a) => a.id));
  const available = pool.filter((a) => !heldIds.has(a.id));
  // If we don't have enough unique arcana, fall back to allowing dupes.
  const source = available.length >= count ? available : pool.slice();
  const picks: Arcana[] = [];
  const indices = source.map((_, i) => i);
  for (let i = 0; i < count && indices.length > 0; i++) {
    const j = Math.floor(rng() * indices.length);
    const idx = indices.splice(j, 1)[0]!;
    picks.push(source[idx]!);
  }
  return picks;
}
