import { describe, expect, it } from "vitest";
import { findMatches } from "../game/engine/match";
import { clearAndRefillOnce } from "../game/engine/cascade";
import { createRng } from "../game/engine/rng";
import type { Board, Suit, Tile, TileKind } from "../game/engine/types";

// A compact board builder: each char becomes a tile.
//   c p s w  → cups / pentacles / swords / wands
//   C P S W  → spark of that suit
//   *        → wild (suit stored as cups; arbitrary, the engine treats
//              wild as suit-agnostic in matching)
function makeBoard(rows: string[]): Board {
  const cols = rows[0]!.length;
  const tiles: Tile[] = [];
  let id = 1000; // high ids so engine refills don't collide
  for (const r of rows) {
    for (const ch of r) {
      tiles.push(parseTile(ch, id++));
    }
  }
  return { rows: rows.length, cols, tiles };
}

function parseTile(ch: string, id: number): Tile {
  if (ch === "*") return { id, suit: "cups", kind: "wild" };
  const lower = ch.toLowerCase();
  const suit = charToSuit(lower);
  const kind: TileKind | undefined = ch !== lower ? "spark" : undefined;
  return kind ? { id, suit, kind } : { id, suit };
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

describe("wild tiles — match detection", () => {
  it("wild bridges two same-suit tiles into a match-3", () => {
    const board = makeBoard([
      "c*cp",
      "wpsw",
      "pwsp",
    ]);
    const matches = findMatches(board);
    const cup3 = matches.find((m) => m.suit === "cups" && m.cells.length === 3);
    expect(cup3).toBeDefined();
  });

  it("a run of only wilds is NOT a match (no anchor suit)", () => {
    const board = makeBoard([
      "****",
      "ccpp",
      "ppcc",
    ]);
    const matches = findMatches(board);
    expect(matches).toEqual([]);
  });

  it("wild between two different suits does NOT match", () => {
    // cup + wild + swords + pent: anchor=cups (cell 0), wild extends,
    // swords breaks the run.
    const board = makeBoard([
      "c*sp",
      "wpwc",
      "pwcp",
    ]);
    const matches = findMatches(board);
    expect(matches).toEqual([]);
  });

  it("wild can extend a match to length 5 (c-*-c-*-c)", () => {
    const board = makeBoard([
      "c*c*c",
      "wpsws",
      "pwspw",
    ]);
    const matches = findMatches(board);
    const long = matches.find((m) => m.suit === "cups" && m.cells.length === 5);
    expect(long).toBeDefined();
  });

  it("wild can lead a run — *-c-c matches as cups", () => {
    const board = makeBoard([
      "*ccp",
      "wpsw",
      "pwsp",
    ]);
    const matches = findMatches(board);
    const m = matches.find((g) => g.suit === "cups" && g.cells.length === 3);
    expect(m).toBeDefined();
  });

  it("vertical wild bridges work the same way", () => {
    const board = makeBoard([
      "cpws",
      "*sws",
      "cpws",
    ]);
    const matches = findMatches(board);
    const m = matches.find(
      (g) =>
        g.suit === "cups" &&
        g.cells.length === 3 &&
        g.cells.every((c) => c.col === 0),
    );
    expect(m).toBeDefined();
  });
});

describe("wild tiles — promotion via match-5", () => {
  // Exercising clearAndRefillOnce directly (one pass, no chain) so the
  // assertion isn't fighting refill randomness.
  it("a match-5 plants a wild at the middle cell", () => {
    const board = makeBoard([
      "ccccc",
      "wpsws",
      "pwspw",
      "sspwc",
    ]);
    const matches = findMatches(board);
    const rng = createRng(1);
    const { board: out } = clearAndRefillOnce(board, matches, rng);
    // Middle of a 5-cell match at row 0 is column 2. After collapse,
    // that wild stays put.
    const wildAt02 = out.tiles[0 * out.cols + 2];
    expect(wildAt02?.kind).toBe("wild");
    expect(wildAt02?.suit).toBe("cups");
  });

  it("a match-4 still plants a spark, not a wild", () => {
    const board = makeBoard([
      "ccccp",
      "wpsws",
      "pwspw",
      "sspwc",
    ]);
    const matches = findMatches(board);
    const rng = createRng(1);
    const { board: out } = clearAndRefillOnce(board, matches, rng);
    // Middle of a 4-cell match at row 0 cells 0-3 is cell index 2 → col 2.
    const at02 = out.tiles[0 * out.cols + 2];
    expect(at02?.kind).toBe("spark");
    // No wild was promoted from the match-4.
    const wilds = out.tiles.filter((t) => t && t.kind === "wild");
    expect(wilds).toHaveLength(0);
  });

  it("a match-6 also plants a wild (not two)", () => {
    const board = makeBoard([
      "cccccc",
      "wpswsw",
      "pwspws",
      "sspwcs",
    ]);
    const matches = findMatches(board);
    const rng = createRng(1);
    const { board: out } = clearAndRefillOnce(board, matches, rng);
    const wilds = out.tiles.filter((t) => t && t.kind === "wild");
    expect(wilds).toHaveLength(1);
    expect(wilds[0]?.suit).toBe("cups");
  });
});
