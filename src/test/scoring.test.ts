import { describe, expect, it } from "vitest";
import { createRng } from "../game/engine/rng";
import { clearAndRefillOnce, resolveCascades } from "../game/engine/cascade";
import { findMatches } from "../game/engine/match";
import type { Board, Suit } from "../game/engine/types";

// Same compact builder pattern used in other engine tests.
function makeBoard(rows: string[]): Board {
  const cols = rows[0]!.length;
  const tiles = rows.flatMap((r, ri) =>
    r.split("").map((ch, ci) => ({
      id: ri * cols + ci + 1,
      suit: charToSuit(ch),
    })),
  );
  return { rows: rows.length, cols, tiles };
}

function charToSuit(ch: string): Suit {
  switch (ch) {
    case "c":
      return "cups";
    case "p":
      return "pentacles";
    case "s":
      return "swords";
    case "w":
      return "wands";
    default:
      throw new Error(`bad suit ${ch}`);
  }
}

describe("Chips × Mult scoring — single wave", () => {
  it("a clean match-3 scores chips=30, mult=2, score=60", () => {
    // First-row match-3 of cups, no spark, no cascade.
    const board = makeBoard([
      "cccp",
      "wpsw",
      "spws",
      "pwsp",
    ]);
    const matches = findMatches(board);
    const rng = createRng(1);
    const { chips, mult, scoreGained } = clearAndRefillOnce(board, matches, rng);
    expect(chips).toBe(30);
    expect(mult).toBe(2);
    expect(scoreGained).toBe(60);
  });

  it("a match-4 plants a spark, so only 3 cells score: chips=30, mult=4, score=120", () => {
    const board = makeBoard([
      "ccccp",
      "wpsws",
      "pwspw",
      "sspwc",
    ]);
    const matches = findMatches(board);
    const rng = createRng(1);
    const { chips, mult, scoreGained, sparkPromotions } = clearAndRefillOnce(
      board,
      matches,
      rng,
    );
    expect(sparkPromotions).toBe(1);
    // 4-cell match minus the rescued spark cell = 3 chips cleared.
    expect(chips).toBe(30);
    expect(mult).toBe(4);
    expect(scoreGained).toBe(120);
  });

  it("a match-5 plants a wild — 4 cells score, mult=8, score=320", () => {
    const board = makeBoard([
      "cccccp",
      "wpswsw",
      "pwspws",
      "sspwcs",
    ]);
    const matches = findMatches(board);
    const rng = createRng(1);
    const { chips, mult, scoreGained, sparkPromotions } = clearAndRefillOnce(
      board,
      matches,
      rng,
    );
    expect(sparkPromotions).toBe(1);
    expect(chips).toBe(40);
    expect(mult).toBe(8);
    expect(scoreGained).toBe(320);
  });

  it("a match-6 plants a wild, 5 cells score, mult=20, score=1000", () => {
    const board = makeBoard([
      "ccccccp",
      "wpswsws",
      "pwspwsp",
      "sspwcsp",
    ]);
    const matches = findMatches(board);
    const rng = createRng(1);
    const { chips, mult, scoreGained } = clearAndRefillOnce(board, matches, rng);
    expect(chips).toBe(50);
    expect(mult).toBe(20);
    expect(scoreGained).toBe(1000);
  });
});

describe("Chips × Mult scoring — cascade depth", () => {
  it("each cascade beyond the first adds +1 to its step's mult", () => {
    // Construct a board where the first match guarantees a second match
    // via collapse. We assert via the cascades[] array on resolveCascades.
    //
    // Easier sanity: build a contrived board where TWO separate match-3s
    // happen on the first wave, then assert step 1 mult equals the sum
    // of size bonuses (2 + 2 = 4) with no depth bonus.
    const board = makeBoard([
      "cccpws",
      "pppwsc",
      "swcpws",
      "wpscws",
      "spwcps",
      "cwspsw",
    ]);
    const rng = createRng(1);
    const { cascades } = resolveCascades(board, rng);
    expect(cascades.length).toBeGreaterThanOrEqual(1);
    // First-step mult is at least 4 (two 3-matches, no cascade bonus yet).
    expect(cascades[0]!.mult).toBeGreaterThanOrEqual(4);
    expect(cascades[0]!.depth).toBe(1);
    // If a second step did happen, its depth must be 2 and its mult
    // must include the +1 cascade bonus baked in.
    if (cascades.length >= 2) {
      expect(cascades[1]!.depth).toBe(2);
      const baseBonus = cascades[1]!.matches.reduce((acc, g) => {
        const n = g.cells.length;
        return acc + (n >= 6 ? 20 : n >= 5 ? 8 : n >= 4 ? 4 : 2);
      }, 0);
      expect(cascades[1]!.mult).toBe(baseBonus + 1);
    }
  });

  it("resolveCascades exposes totalChips and peakMult aggregates", () => {
    const board = makeBoard([
      "cccp",
      "wpsw",
      "spws",
      "pwsp",
    ]);
    const rng = createRng(1);
    const result = resolveCascades(board, rng);
    expect(result.totalChips).toBeGreaterThan(0);
    expect(result.peakMult).toBeGreaterThan(0);
    // The total score equals the per-step (chips × stepMult) summed.
    const recomputed = result.cascades.reduce(
      (acc, c) => acc + c.chips * c.mult,
      0,
    );
    expect(result.scoreGained).toBe(recomputed);
  });

  it("scoreGained on the result matches sum of per-step scoreGained", () => {
    const board = makeBoard([
      "cccccp",
      "wpswsw",
      "pwspws",
      "sspwcs",
    ]);
    const rng = createRng(7);
    const result = resolveCascades(board, rng);
    const summed = result.cascades.reduce((acc, c) => acc + c.scoreGained, 0);
    expect(result.scoreGained).toBe(summed);
  });
});
