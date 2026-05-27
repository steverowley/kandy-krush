import { newTile } from "./board";
import { findMatches } from "./match";
import { rngPick } from "./rng";
import { SUITS, type Board, type CascadeStep, type Cell, type MatchGroup, type Tile } from "./types";

function indexOf(board: Board, cell: Cell): number {
  return cell.row * board.cols + cell.col;
}

/** Chips added per cell cleared. Will eventually be modified by per-suit
 *  level (Planet-card analog); for now every suit has level 1. */
const CHIPS_PER_CELL = 10;

/** Chips contributed by a single spark blast (in addition to whatever
 *  cells the blast clears, which score normally). */
const CHIPS_PER_SPARK = 30;

/** Mult bonus by match size. Per the design brief:
 *  3 → +2, 4 → +4, 5 → +8, 6+ → +20. */
function multForMatchSize(n: number): number {
  if (n >= 6) return 20;
  if (n >= 5) return 8;
  if (n >= 4) return 4;
  return 2;
}

/**
 * Resolve one match wave: figure out the clear set (expanding via any
 * sparks caught in the original match cells), promote any match-4+
 * groups into a spark or wild survivor, null out the rest, collapse and
 * refill.
 *
 * Returns the post-step board plus a Balatro-style breakdown — chips
 * (sum of cell + spark contributions) and mult (sum of match-size
 * bonuses). The caller multiplies these to get the step's score, and
 * may layer a cascade-depth bonus onto the mult first.
 *
 * Exported so tests can exercise the promotion logic on a single pass
 * without dealing with downstream cascades.
 */
export function clearAndRefillOnce(
  board: Board,
  matches: MatchGroup[],
  rng: () => number,
): {
  board: Board;
  chips: number;
  mult: number;
  scoreGained: number;
  sparkPromotions: number;
  sparkBlasts: number;
} {
  const tiles = board.tiles.slice();
  const clearSet = new Set<number>();

  for (const group of matches) {
    for (const cell of group.cells) clearSet.add(indexOf(board, cell));
  }

  // Spark cascade: any spark caught in the clear set sweeps its entire
  // row + column. Repeat until the set is stable so chains of sparks
  // fire properly.
  let sparkBlasts = 0;
  let frontier = Array.from(clearSet);
  while (frontier.length > 0) {
    const nextFrontier: number[] = [];
    for (const idx of frontier) {
      const t = tiles[idx];
      if (t && t.kind === "spark") {
        sparkBlasts++;
        const row = Math.floor(idx / board.cols);
        const col = idx % board.cols;
        for (let c = 0; c < board.cols; c++) {
          const i = row * board.cols + c;
          if (!clearSet.has(i)) {
            clearSet.add(i);
            nextFrontier.push(i);
          }
        }
        for (let r = 0; r < board.rows; r++) {
          const i = r * board.cols + col;
          if (!clearSet.has(i)) {
            clearSet.add(i);
            nextFrontier.push(i);
          }
        }
      }
    }
    frontier = nextFrontier;
  }

  // Promote one cell per match-4+ group to a special tile. Pick the
  // middle cell of the group — deterministic and visually central.
  // The promoted cell is rescued from the clear set.
  //   match-4    → spark (clears row+col when later cleared)
  //   match-5+   → wild  (counts as any suit, no special clear effect)
  const sparkPlants: Array<{ idx: number; tile: Tile }> = [];
  let sparkPromotions = 0;
  for (const group of matches) {
    if (group.cells.length < 4) continue;
    const middle = group.cells[Math.floor(group.cells.length / 2)]!;
    const idx = indexOf(board, middle);
    const oldTile = tiles[idx];
    if (!oldTile) continue;
    const kind: Tile["kind"] = group.cells.length >= 5 ? "wild" : "spark";
    sparkPlants.push({
      idx,
      tile: { id: oldTile.id, suit: group.suit, kind },
    });
    clearSet.delete(idx);
    sparkPromotions++;
  }

  // Balatro-style scoring: chips × mult.
  //
  //   chips = (cells actually cleared this wave) × CHIPS_PER_CELL
  //         + sparkBlasts × CHIPS_PER_SPARK
  //   mult  = sum of match-size bonuses across the original groups
  //
  // The total clearSet (after spark expansion, minus rescued promotions)
  // is what scored — that way spark blasts naturally reward bigger
  // collateral via the increased chip count.
  let mult = 0;
  for (const group of matches) {
    mult += multForMatchSize(group.cells.length);
  }
  const chips = clearSet.size * CHIPS_PER_CELL + sparkBlasts * CHIPS_PER_SPARK;
  const scoreGained = chips * mult;

  // Null cleared cells.
  for (const idx of clearSet) tiles[idx] = null;

  // Apply spark promotions.
  for (const p of sparkPlants) tiles[p.idx] = p.tile;

  // Collapse per column.
  for (let col = 0; col < board.cols; col++) {
    let writeRow = board.rows - 1;
    for (let row = board.rows - 1; row >= 0; row--) {
      const idx = row * board.cols + col;
      const t = tiles[idx];
      if (t) {
        if (writeRow !== row) {
          tiles[writeRow * board.cols + col] = t;
          tiles[idx] = null;
        }
        writeRow--;
      }
    }
    // Refill empties with fresh normal tiles.
    for (let row = writeRow; row >= 0; row--) {
      tiles[row * board.cols + col] = newTile(rngPick(rng, SUITS));
    }
  }

  return {
    board: { ...board, tiles },
    chips,
    mult,
    scoreGained,
    sparkPromotions,
    sparkBlasts,
  };
}

/**
 * Drive the board to a stable state by repeatedly clearing matches +
 * cascading. Each cascade beyond the first adds +1 to its step's mult
 * — so chains snowball Balatro-style without runaway exponents.
 */
export function resolveCascades(
  board: Board,
  rng: () => number,
): {
  board: Board;
  cascades: CascadeStep[];
  scoreGained: number;
  totalChips: number;
  peakMult: number;
} {
  const cascades: CascadeStep[] = [];
  let totalScore = 0;
  let totalChips = 0;
  let peakMult = 0;
  let depth = 1;
  let cur = board;

  while (true) {
    const matches = findMatches(cur);
    if (matches.length === 0) break;
    const { board: next, chips, mult } = clearAndRefillOnce(cur, matches, rng);
    const stepMult = mult + (depth - 1);
    const stepScore = chips * stepMult;
    cascades.push({ matches, depth, chips, mult: stepMult, scoreGained: stepScore });
    totalScore += stepScore;
    totalChips += chips;
    if (stepMult > peakMult) peakMult = stepMult;
    cur = next;
    depth++;
    if (depth > 50) break;
  }

  return { board: cur, cascades, scoreGained: totalScore, totalChips, peakMult };
}

export function hasLegalMove(board: Board): boolean {
  for (let row = 0; row < board.rows; row++) {
    for (let col = 0; col < board.cols; col++) {
      const here: Cell = { row, col };
      if (col + 1 < board.cols) {
        if (trialSwap(board, here, { row, col: col + 1 })) return true;
      }
      if (row + 1 < board.rows) {
        if (trialSwap(board, here, { row: row + 1, col })) return true;
      }
    }
  }
  return false;
}

function trialSwap(board: Board, a: Cell, b: Cell): boolean {
  const tiles = board.tiles.slice();
  const ia = a.row * board.cols + a.col;
  const ib = b.row * board.cols + b.col;
  const tmp = tiles[ia] ?? null;
  tiles[ia] = tiles[ib] ?? null;
  tiles[ib] = tmp;
  return findMatches({ ...board, tiles }).length > 0;
}
