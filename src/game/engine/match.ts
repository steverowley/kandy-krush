import { indexOf, inBounds } from "./board";
import type { Board, Cell, MatchGroup, Suit, Tile } from "./types";

/** Find all matched groups (runs of 3+ same-suit cells, wild tiles
 *  count as any suit) on the board. */
export function findMatches(board: Board): MatchGroup[] {
  const groups: MatchGroup[] = [];

  for (let row = 0; row < board.rows; row++) {
    scanLine(
      board.cols,
      (i) => board.tiles[row * board.cols + i] ?? null,
      (start, end, suit, hasWild) => {
        const cells: Cell[] = [];
        for (let c = start; c < end; c++) cells.push({ row, col: c });
        groups.push(hasWild ? { suit, cells, hasWild } : { suit, cells });
      },
    );
  }

  for (let col = 0; col < board.cols; col++) {
    scanLine(
      board.rows,
      (i) => board.tiles[i * board.cols + col] ?? null,
      (start, end, suit, hasWild) => {
        const cells: Cell[] = [];
        for (let r = start; r < end; r++) cells.push({ row: r, col });
        groups.push(hasWild ? { suit, cells, hasWild } : { suit, cells });
      },
    );
  }

  return groups;
}

/** Walk one line (a row or column) and emit any match runs found.
 *  A wild tile extends a run of any anchor suit. A run is only a match
 *  if it is 3+ long AND contains at least one non-wild tile (so the
 *  anchor suit is defined). The emitter receives a `hasWild` flag so
 *  arcana like The Star can detect wild-involved matches. */
function scanLine(
  length: number,
  getTile: (i: number) => Tile | null,
  emit: (start: number, end: number, suit: Suit, hasWild: boolean) => void,
): void {
  let start = 0;
  let anchor: Suit | null = null;
  let hasNonWild = false;
  let hasWild = false;

  function closeRun(end: number) {
    if (end - start >= 3 && anchor !== null && hasNonWild) {
      emit(start, end, anchor, hasWild);
    }
  }

  function resetAt(i: number, t: Tile | null) {
    start = i;
    anchor = t && t.kind !== "wild" ? t.suit : null;
    hasNonWild = !!t && t.kind !== "wild";
    hasWild = !!t && t.kind === "wild";
  }

  // Seed with the first cell.
  const t0 = getTile(0);
  if (!t0) {
    start = 1;
  } else {
    resetAt(0, t0);
  }

  for (let i = 1; i < length; i++) {
    const t = getTile(i);
    let extending: boolean;
    if (!t) {
      extending = false;
    } else if (t.kind === "wild") {
      extending = true;
    } else if (anchor === null) {
      // First non-wild in a run that started with wilds.
      extending = true;
      anchor = t.suit;
      hasNonWild = true;
    } else {
      extending = t.suit === anchor;
    }

    if (extending) {
      if (t && t.kind === "wild") hasWild = true;
      else if (t) hasNonWild = true;
    } else {
      closeRun(i);
      if (!t) {
        start = i + 1;
        anchor = null;
        hasNonWild = false;
        hasWild = false;
      } else {
        resetAt(i, t);
      }
    }
  }

  closeRun(length);
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
