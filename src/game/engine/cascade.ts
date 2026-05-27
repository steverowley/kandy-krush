import { newTile } from "./board";
import { findMatches } from "./match";
import { rngPick } from "./rng";
import { SUITS, type Board, type CascadeStep, type Cell, type MatchGroup } from "./types";

/**
 * Remove matched tiles, drop survivors, refill from above with the rng.
 * Returns the new board, the matches that were cleared, and the score
 * gained from this single step.
 */
function clearAndRefillOnce(
  board: Board,
  matches: MatchGroup[],
  rng: () => number,
): { board: Board; scoreGained: number } {
  // Mark cleared cells.
  const tiles = board.tiles.slice();
  let cleared = 0;
  const isCleared = new Set<number>();
  for (const group of matches) {
    for (const cell of group.cells) {
      const idx = cell.row * board.cols + cell.col;
      if (!isCleared.has(idx)) {
        isCleared.add(idx);
        cleared++;
      }
    }
  }
  for (const idx of isCleared) tiles[idx] = null;

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
    // Refill the empties at the top with new tiles.
    for (let row = writeRow; row >= 0; row--) {
      tiles[row * board.cols + col] = newTile(rngPick(rng, SUITS));
    }
  }

  // Score: standard match-3 — base 10 per tile, +5 bonus for each cell
  // past the third within a group. Cascades multiply elsewhere.
  let scoreGained = 0;
  for (const group of matches) {
    const n = group.cells.length;
    scoreGained += n * 10 + Math.max(0, n - 3) * 5;
  }
  void cleared;

  return { board: { ...board, tiles }, scoreGained };
}

/**
 * Resolve the board to a stable state by repeatedly clearing matches +
 * cascading until no more matches exist. Each cascade level multiplies
 * its base score by the chain depth (1×, 2×, 3×, …).
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
    if (depth > 50) break; // hard guard against runaway
  }

  return { board: cur, cascades, scoreGained: totalScore };
}

/** True if at least one swap would produce a match. */
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
