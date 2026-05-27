import { newTile } from "./board";
import { findMatches } from "./match";
import { rngPick } from "./rng";
import { SUITS, type Board, type CascadeStep, type Cell, type MatchGroup, type Tile } from "./types";

function indexOf(board: Board, cell: Cell): number {
  return cell.row * board.cols + cell.col;
}

/**
 * Resolve one match wave: figure out the clear set (expanding via any
 * sparks caught in the original match cells), promote any match-4+
 * groups into a spark or wild survivor, null out the rest, collapse and
 * refill.
 *
 * Returns the post-step board + score gained. Exported so tests can
 * exercise the promotion logic on a single pass without dealing with
 * downstream cascades.
 */
export function clearAndRefillOnce(
  board: Board,
  matches: MatchGroup[],
  rng: () => number,
): { board: Board; scoreGained: number; sparkPromotions: number; sparkBlasts: number } {
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

  // Score: 10 per cleared cell, +5 per cell past 3 in the original
  // matches. Spark blasts add 30 each as a "fortune boon."
  let scoreGained = 0;
  for (const group of matches) {
    const n = group.cells.length;
    scoreGained += n * 10 + Math.max(0, n - 3) * 5;
  }
  scoreGained += sparkBlasts * 30;
  // Bonus for the spark blast's collateral clears.
  // (Already implicit: more cleared cells from the next-wave refill.)

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
    scoreGained,
    sparkPromotions,
    sparkBlasts,
  };
}

/**
 * Drive the board to a stable state by repeatedly clearing matches +
 * cascading. Cascade depth multiplies the per-step score.
 */
export function resolveCascades(
  board: Board,
  rng: () => number,
): { board: Board; cascades: CascadeStep[]; scoreGained: number } {
  const cascades: CascadeStep[] = [];
  let totalScore = 0;
  let depth = 1;
  let cur = board;

  while (true) {
    const matches = findMatches(cur);
    if (matches.length === 0) break;
    const { board: next, scoreGained } = clearAndRefillOnce(cur, matches, rng);
    const stepScore = scoreGained * depth;
    cascades.push({ matches, scoreGained: stepScore });
    totalScore += stepScore;
    cur = next;
    depth++;
    if (depth > 50) break;
  }

  return { board: cur, cascades, scoreGained: totalScore };
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
