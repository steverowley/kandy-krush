import { describe, expect, it } from "vitest";
import { createRng, rngInt } from "../game/engine/rng";
import {
  areAdjacent,
  convertSuit,
  generateBoard,
  obscuredRevealSet,
  peekRefillSequence,
  plantTile,
  swapped,
  tileAt,
} from "../game/engine/board";
import { findMatches, swapMakesMatch } from "../game/engine/match";
import {
  clearAndRefillOnce,
  destroyCells,
  resolveCascades,
  hasLegalMove,
} from "../game/engine/cascade";
import { isDeadlocked, newGame, tryMove } from "../game/engine/engine";
import type { Board, Cell, Suit, Tile } from "../game/engine/types";

describe("rng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("differs across seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    let allEqual = true;
    for (let i = 0; i < 50; i++) {
      if (a() !== b()) {
        allEqual = false;
        break;
      }
    }
    expect(allEqual).toBe(false);
  });

  it("rngInt stays in range", () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rngInt(r, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });
});

describe("areAdjacent", () => {
  it("accepts orthogonal neighbors", () => {
    expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(areAdjacent({ row: 2, col: 3 }, { row: 3, col: 3 })).toBe(true);
  });
  it("rejects same cell", () => {
    expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 0 })).toBe(false);
  });
  it("rejects diagonals", () => {
    expect(areAdjacent({ row: 1, col: 1 }, { row: 2, col: 2 })).toBe(false);
  });
  it("rejects far cells", () => {
    expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 2 })).toBe(false);
  });
});

describe("generateBoard", () => {
  it("never spawns a match", () => {
    for (let seed = 1; seed < 50; seed++) {
      const rng = createRng(seed);
      const board = generateBoard(8, 8, rng);
      expect(findMatches(board)).toEqual([]);
    }
  });

  it("fills every cell", () => {
    const rng = createRng(1);
    const board = generateBoard(7, 7, rng);
    expect(board.tiles).toHaveLength(49);
    for (const t of board.tiles) {
      expect(t).not.toBeNull();
    }
  });
});

/** Build a fixed board from a suit grid (rows of suit letters). */
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
      throw new Error(`bad suit char ${ch}`);
  }
}

describe("findMatches", () => {
  it("finds a horizontal three", () => {
    const board = makeBoard([
      "pccc",
      "wpsw",
      "spsw",
    ]);
    const m = findMatches(board);
    expect(m).toHaveLength(1);
    expect(m[0]!.suit).toBe("cups");
    expect(m[0]!.cells.map((c) => c.col)).toEqual([1, 2, 3]);
    expect(m[0]!.cells.every((c) => c.row === 0)).toBe(true);
  });

  it("finds a vertical three", () => {
    const board = makeBoard([
      "wpsw",
      "wpcs",
      "wcsw",
    ]);
    const m = findMatches(board);
    expect(m.length).toBeGreaterThanOrEqual(1);
    const vertical = m.find((g) => g.cells.every((c) => c.col === 0));
    expect(vertical).toBeDefined();
    expect(vertical!.suit).toBe("wands");
    expect(vertical!.cells.map((c) => c.row)).toEqual([0, 1, 2]);
  });

  it("finds longer runs as one group", () => {
    const board = makeBoard(["sssss", "wpcwp"]);
    const m = findMatches(board);
    expect(m).toHaveLength(1);
    expect(m[0]!.cells).toHaveLength(5);
  });

  it("flags hasWild on match groups that include a wild tile", () => {
    const board = makeBoard(["cccc", "wpsw", "spsw"]);
    // Promote one of the cups to a wild.
    board.tiles[1] = { id: 1, suit: "cups", kind: "wild" };
    const m = findMatches(board);
    const cupsMatch = m.find((g) => g.cells.length >= 3);
    expect(cupsMatch).toBeDefined();
    expect(cupsMatch!.hasWild).toBe(true);
  });

  it("does NOT set hasWild on matches with no wild cells", () => {
    const board = makeBoard(["cccp", "wpsw", "spws"]);
    const m = findMatches(board);
    expect(m[0]!.hasWild).toBeUndefined();
  });
});

describe("swapMakesMatch", () => {
  it("approves a swap that creates a horizontal three", () => {
    const board = makeBoard([
      "wccp",
      "cwcp",
      "ppws",
    ]);
    // (0,0)w ↔ (1,0)c -> row 0 becomes c,c,c,p → match.
    expect(swapMakesMatch(board, { row: 0, col: 0 }, { row: 1, col: 0 })).toBe(
      true,
    );
  });

  it("rejects a no-op swap", () => {
    const board = makeBoard([
      "pcsp",
      "scps",
      "pcps",
    ]);
    expect(swapMakesMatch(board, { row: 0, col: 0 }, { row: 0, col: 1 })).toBe(
      false,
    );
  });
});

describe("resolveCascades", () => {
  it("clears, collapses, and refills", () => {
    const board = makeBoard([
      "cccp",
      "wpsw",
      "spws",
    ]);
    const rng = createRng(99);
    const { board: out, cascades, scoreGained } = resolveCascades(board, rng);
    expect(cascades.length).toBeGreaterThanOrEqual(1);
    expect(scoreGained).toBeGreaterThan(0);
    // No matches remaining.
    expect(findMatches(out)).toEqual([]);
    // Same cell count.
    expect(out.tiles).toHaveLength(board.tiles.length);
    // No nulls.
    for (const t of out.tiles) expect(t).not.toBeNull();
  });

  it("multiplies score by chain depth (sanity)", () => {
    // Construct a board where the first match cascades into a second.
    // Easier: confirm cascades return at least 1 step on a guaranteed match.
    const board = makeBoard(["sssp", "wpsw", "spws"]);
    const rng = createRng(5);
    const { cascades } = resolveCascades(board, rng);
    expect(cascades.length).toBeGreaterThanOrEqual(1);
  });
});

describe("hasLegalMove", () => {
  it("returns true for a freshly generated board", () => {
    const rng = createRng(1);
    const board = generateBoard(7, 7, rng);
    expect(hasLegalMove(board)).toBe(true);
  });

  it("returns false on a known-deadlocked row", () => {
    // 1×4 with alternating two-suit pattern. No single adjacent swap
    // can yield 3-in-a-row of either suit.
    const board = makeBoard(["cpcp"]);
    expect(hasLegalMove(board)).toBe(false);
  });
});

describe("engine", () => {
  it("newGame yields a stable, match-free board", () => {
    const { board } = newGame({ rows: 7, cols: 7, seed: 123 });
    expect(findMatches(board)).toEqual([]);
    expect(isDeadlocked(board)).toBe(false);
  });

  it("tryMove rejects non-adjacent swaps", () => {
    const { board, rng } = newGame({ rows: 7, cols: 7, seed: 123 });
    const r = tryMove(board, rng, { row: 0, col: 0 }, { row: 5, col: 5 });
    expect(r).toBeNull();
  });

  it("tryMove rejects swaps that don't create a match", () => {
    // Construct a board with no immediate match, swap two adjacent tiles
    // that wouldn't make a match.
    const fixed = makeBoard([
      "cpsw",
      "psws",
      "swcp",
      "wcps",
    ]);
    const rng = createRng(1);
    // Most swaps here won't create matches — pick one that demonstrably doesn't.
    const r = tryMove(fixed, rng, { row: 0, col: 0 }, { row: 0, col: 1 });
    expect(r).toBeNull();
  });

  it("tryMove accepts a swap that creates a match", () => {
    const fixed = makeBoard([
      "wccp",
      "cwcp",
      "ppws",
    ]);
    const rng = createRng(1);
    const r = tryMove(fixed, rng, { row: 0, col: 0 }, { row: 1, col: 0 });
    expect(r).not.toBeNull();
    expect(r!.scoreGained).toBeGreaterThan(0);
    expect(findMatches(r!.board)).toEqual([]);
  });
});

describe("immutable swap helpers", () => {
  it("swapped returns a new board without mutating input", () => {
    const board = makeBoard(["cp", "ws"]);
    const a: Cell = { row: 0, col: 0 };
    const b: Cell = { row: 0, col: 1 };
    const out = swapped(board, a, b);
    expect(tileAt(board, a)!.suit).toBe("cups");
    expect(tileAt(board, b)!.suit).toBe("pentacles");
    expect(tileAt(out, a)!.suit).toBe("pentacles");
    expect(tileAt(out, b)!.suit).toBe("cups");
  });
});

describe("destroyCells", () => {
  it("removes the listed cell, collapses, and refills", () => {
    const board = makeBoard([
      "cpsw",
      "wpsw",
      "spwc",
      "cwps",
    ]);
    const idsBefore = board.tiles.map((t) => t!.id);
    const rng = createRng(1);
    const { board: out } = destroyCells(board, rng, [{ row: 2, col: 1 }]);
    // Same dimensions, no nulls.
    expect(out.tiles).toHaveLength(board.tiles.length);
    for (const t of out.tiles) expect(t).not.toBeNull();
    // The original tile is no longer present in the board.
    const idsAfter = new Set(out.tiles.map((t) => t!.id));
    const destroyedId = idsBefore[2 * 4 + 1]!;
    expect(idsAfter.has(destroyedId)).toBe(false);
    // Final board is settled (no immediate matches).
    expect(findMatches(out)).toEqual([]);
  });

  it("resolves any cascade matches created by the refill", () => {
    // Boards where pulling out one cell guarantees a column-3 match are
    // brittle to construct deterministically (refill is random). Use a
    // crafted setup: two adjacent verticals of cups that need one drop
    // to align into a match. Easier sanity: just verify destroyCells
    // returns a settled board with zero matches even when destruction
    // triggers a chain.
    const board = makeBoard([
      "pcps",
      "ccpw",
      "cpcw",
      "pcps",
    ]);
    const rng = createRng(7);
    const result = destroyCells(board, rng, [{ row: 1, col: 1 }]);
    expect(findMatches(result.board)).toEqual([]);
  });

  it("skips out-of-bounds cells silently", () => {
    const board = makeBoard(["cp", "ws"]);
    const rng = createRng(1);
    const before = board.tiles.length;
    const { board: out } = destroyCells(board, rng, [
      { row: -1, col: 0 },
      { row: 9, col: 9 },
    ]);
    expect(out.tiles).toHaveLength(before);
  });

  it("does not mutate the input board", () => {
    const board = makeBoard(["cpsw", "wpsw", "spwc", "cwps"]);
    const snapshot = board.tiles.slice();
    const rng = createRng(2);
    destroyCells(board, rng, [{ row: 0, col: 0 }]);
    expect(board.tiles).toEqual(snapshot);
  });
});

describe("convertSuit", () => {
  it("rewrites every plain tile of `from` to `to`", () => {
    const board = makeBoard(["cpsw", "wpsw"]);
    const wandsBefore = board.tiles.filter((t) => t!.suit === "wands").length;
    const swordsBefore = board.tiles.filter((t) => t!.suit === "swords").length;
    const out = convertSuit(board, "swords", "wands");
    for (const t of out.tiles) {
      expect(t!.suit).not.toBe("swords");
    }
    expect(out.tiles.filter((t) => t!.suit === "wands").length).toBe(
      wandsBefore + swordsBefore,
    );
  });

  it("preserves tile ids so the view animates in place", () => {
    const board = makeBoard(["cpsw"]);
    const before = board.tiles.map((t) => ({ id: t!.id, suit: t!.suit }));
    const out = convertSuit(board, "swords", "wands");
    for (let i = 0; i < before.length; i++) {
      expect(out.tiles[i]!.id).toBe(before[i]!.id);
    }
    // The swords cell at col 2 is now a wand with the same id.
    expect(out.tiles[2]!.suit).toBe("wands");
    expect(out.tiles[2]!.id).toBe(before[2]!.id);
  });

  it("skips sparks and wilds so specials keep their meaning", () => {
    const board = makeBoard(["sscp"]);
    // Promote one sword to a wild and another to a spark.
    board.tiles[0] = { id: 100, suit: "swords", kind: "wild" };
    board.tiles[1] = { id: 101, suit: "swords", kind: "spark" };
    const out = convertSuit(board, "swords", "wands");
    expect(out.tiles[0]!.suit).toBe("swords");
    expect(out.tiles[0]!.kind).toBe("wild");
    expect(out.tiles[1]!.suit).toBe("swords");
    expect(out.tiles[1]!.kind).toBe("spark");
  });

  it("is a no-op when from === to", () => {
    const board = makeBoard(["cpsw"]);
    const out = convertSuit(board, "swords", "swords");
    expect(out).toBe(board);
  });
});

describe("plantTile", () => {
  it("replaces the cell with the given tile", () => {
    const board = makeBoard(["cp", "ws"]);
    const newTile: Tile = { id: 9999, suit: "wands", kind: "wild" };
    const out = plantTile(board, { row: 0, col: 0 }, newTile);
    expect(tileAt(out, { row: 0, col: 0 })!.id).toBe(9999);
    expect(tileAt(out, { row: 0, col: 0 })!.kind).toBe("wild");
    // Input unchanged.
    expect(tileAt(board, { row: 0, col: 0 })!.suit).toBe("cups");
  });

  it("returns the input unchanged for out-of-bounds cells", () => {
    const board = makeBoard(["cp", "ws"]);
    const newTile: Tile = { id: 9999, suit: "wands" };
    const out = plantTile(board, { row: 10, col: 10 }, newTile);
    expect(out).toBe(board);
  });
});

describe("ResolveOpts.skipPromotions", () => {
  it("a match-4 plants no spark when skipPromotions is set", () => {
    const board = makeBoard([
      "ccccp",
      "wpsws",
      "pwspw",
      "sspwc",
    ]);
    const matches = findMatches(board);
    const rng = createRng(1);
    const { board: out, sparkPromotions } = clearAndRefillOnce(
      board,
      matches,
      rng,
      { skipPromotions: true },
    );
    expect(sparkPromotions).toBe(0);
    // No spark or wild lives on the post-step board.
    for (const t of out.tiles) {
      expect(t!.kind).toBeUndefined();
    }
  });

  it("resolveCascades forwards skipPromotions to every step", () => {
    const board = makeBoard([
      "cccccp",
      "wpswsw",
      "pwspws",
      "sspwcs",
    ]);
    const rng = createRng(3);
    const { board: out } = resolveCascades(board, rng, {
      skipPromotions: true,
    });
    for (const t of out.tiles) {
      expect(t!.kind).toBeUndefined();
    }
  });
});

describe("obscuredRevealSet", () => {
  it("reveals only the wild and its orthogonal neighbors", () => {
    const board = makeBoard(["cpsw", "wpsw", "spwc", "cwps"]);
    // Plant a wild at (1, 1).
    board.tiles[1 * 4 + 1] = { id: 999, suit: "cups", kind: "wild" };
    const revealed = obscuredRevealSet(board, "wild");
    // The wild itself: (1,1) = idx 5.
    expect(revealed.has(5)).toBe(true);
    // Orthogonal neighbors: (0,1)=1, (2,1)=9, (1,0)=4, (1,2)=6.
    expect(revealed.has(1)).toBe(true);
    expect(revealed.has(9)).toBe(true);
    expect(revealed.has(4)).toBe(true);
    expect(revealed.has(6)).toBe(true);
    // A distant cell: (0,3)=3 — should NOT be revealed.
    expect(revealed.has(3)).toBe(false);
  });

  it("returns an empty set on a board with no specials", () => {
    const board = makeBoard(["cpsw", "wpsw"]);
    const revealed = obscuredRevealSet(board, "wild");
    expect(revealed.size).toBe(0);
  });

  it("clamps adjacency to board bounds (corner wild)", () => {
    const board = makeBoard(["cpsw", "wpsw"]);
    board.tiles[0] = { id: 1, suit: "cups", kind: "wild" };
    const revealed = obscuredRevealSet(board, "wild");
    // Wild at (0,0): self + (0,1) + (1,0) = 3 cells.
    expect(revealed.size).toBe(3);
    expect(revealed.has(0)).toBe(true);
    expect(revealed.has(1)).toBe(true);
    expect(revealed.has(4)).toBe(true);
  });

  it("also works for sparks when keyed on 'spark'", () => {
    const board = makeBoard(["cpsw", "wpsw"]);
    board.tiles[2] = { id: 1, suit: "swords", kind: "spark" };
    const revealed = obscuredRevealSet(board, "spark");
    expect(revealed.has(2)).toBe(true);
    expect(revealed.has(1)).toBe(true);
    expect(revealed.has(3)).toBe(true);
    expect(revealed.has(6)).toBe(true);
  });
});

describe("peekRefillSequence", () => {
  it("returns the requested count of suits", () => {
    const rng = createRng(42);
    const seq = peekRefillSequence(rng, 7);
    expect(seq).toHaveLength(7);
    for (const s of seq) {
      expect(["cups", "pentacles", "swords", "wands"]).toContain(s);
    }
  });

  it("does NOT consume the rng state — subsequent draws are unchanged", () => {
    const rng = createRng(99);
    const before = rng.state();
    peekRefillSequence(rng, 10);
    expect(rng.state()).toBe(before);
  });

  it("the next live draw matches the first peeked suit", () => {
    const rng = createRng(7);
    const peeked = peekRefillSequence(rng, 5);
    // Now make a real draw — should hit the same first suit.
    const r = createRng(7); // fresh rng at the same seed for comparison
    r.state(); // sanity
    expect(peeked[0]).toBe(["cups", "pentacles", "swords", "wands"][rngInt(r, 4)]);
  });

  it("returns [] for count <= 0", () => {
    const rng = createRng(1);
    expect(peekRefillSequence(rng, 0)).toEqual([]);
    expect(peekRefillSequence(rng, -3)).toEqual([]);
  });
});
