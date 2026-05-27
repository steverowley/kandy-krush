import { indexOf, inBounds } from "./board";
import type { Board, Cell, MatchGroup } from "./types";

/** Find all matched groups (runs of 3+ same-suit cells) on the board. */
export function findMatches(board: Board): MatchGroup[] {
  const groups: MatchGroup[] = [];

  // Horizontal runs.
  for (let row = 0; row < board.rows; row++) {
    let runStart = 0;
    for (let col = 1; col <= board.cols; col++) {
      const prev = board.tiles[row * board.cols + (col - 1)];
      const curr = col < board.cols ? board.tiles[row * board.cols + col] : null;
      const sameAsPrev = !!prev && !!curr && prev.suit === curr.suit;
      if (!sameAsPrev) {
        const runLen = col - runStart;
        if (runLen >= 3 && prev) {
          const cells: Cell[] = [];
          for (let c = runStart; c < col; c++) cells.push({ row, col: c });
          groups.push({ suit: prev.suit, cells });
        }
        runStart = col;
      }
    }
  }

  // Vertical runs.
  for (let col = 0; col < board.cols; col++) {
    let runStart = 0;
    for (let row = 1; row <= board.rows; row++) {
      const prev = board.tiles[(row - 1) * board.cols + col];
      const curr =
        row < board.rows ? board.tiles[row * board.cols + col] : null;
      const sameAsPrev = !!prev && !!curr && prev.suit === curr.suit;
      if (!sameAsPrev) {
        const runLen = row - runStart;
        if (runLen >= 3 && prev) {
          const cells: Cell[] = [];
          for (let r = runStart; r < row; r++) cells.push({ row: r, col });
          groups.push({ suit: prev.suit, cells });
        }
        runStart = row;
      }
    }
  }

  return groups;
}

/** True if swapping a↔b would produce at least one match. Used to gate
 * input — illegal swaps revert. */
export function swapMakesMatch(board: Board, a: Cell, b: Cell): boolean {
  if (!inBounds(board, a) || !inBounds(board, b)) return false;
  const tiles = board.tiles.slice();
  const ia = indexOf(board, a);
  const ib = indexOf(board, b);
  const tmp = tiles[ia] ?? null;
  tiles[ia] = tiles[ib] ?? null;
  tiles[ib] = tmp;
  const trial: Board = { ...board, tiles };
  return findMatches(trial).length > 0;
}
