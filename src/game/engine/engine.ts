import { areAdjacent, generateBoard, swapped } from "./board";
import { resolveCascades, hasLegalMove, type ResolveOpts } from "./cascade";
import { swapMakesMatch } from "./match";
import { createRng, type SeededRng } from "./rng";
import type { Board, Cell, ResolveResult } from "./types";

export type EngineConfig = {
  rows: number;
  cols: number;
  seed: number;
};

export function newGame(config: EngineConfig): { board: Board; rng: SeededRng } {
  const rng = createRng(config.seed);
  let board = generateBoard(config.rows, config.cols, rng);
  // Defensive: settle any unlucky spawn-time matches even though we
  // try to avoid them.
  const settled = resolveCascades(board, rng);
  board = settled.board;
  return { board, rng };
}

/** Validate + perform a swap. If illegal, returns null and the caller
 * should bounce the visual without changing state. */
export function tryMove(
  board: Board,
  rng: () => number,
  a: Cell,
  b: Cell,
  opts?: ResolveOpts,
): ResolveResult | null {
  if (!areAdjacent(a, b)) return null;
  if (!swapMakesMatch(board, a, b)) return null;
  const after = swapped(board, a, b);
  const resolved = resolveCascades(after, rng, opts);
  return resolved;
}

/** True if the board is in a deadlock (no legal swap exists). */
export function isDeadlocked(board: Board): boolean {
  return !hasLegalMove(board);
}
