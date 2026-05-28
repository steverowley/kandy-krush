import { rngPick } from "./rng";
import { SUITS, type Board, type Cell, type Suit, type Tile } from "./types";

let nextTileId = 1;
function mintTile(suit: Suit): Tile {
  return { id: nextTileId++, suit };
}

/** Ensure freshly-minted tiles never collide with restored ids. Called
 *  by the daily / save layer after a snapshot is rehydrated. */
export function reserveTileIds(upTo: number) {
  if (upTo + 1 > nextTileId) nextTileId = upTo + 1;
}

export function indexOf(board: Board, cell: Cell): number {
  return cell.row * board.cols + cell.col;
}

export function tileAt(board: Board, cell: Cell): Tile | null {
  if (!inBounds(board, cell)) return null;
  return board.tiles[indexOf(board, cell)] ?? null;
}

export function inBounds(board: Board, cell: Cell): boolean {
  return (
    cell.row >= 0 &&
    cell.row < board.rows &&
    cell.col >= 0 &&
    cell.col < board.cols
  );
}

export function areAdjacent(a: Cell, b: Cell): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

export function withTile(board: Board, cell: Cell, tile: Tile | null): Board {
  const tiles = board.tiles.slice();
  tiles[indexOf(board, cell)] = tile;
  return { ...board, tiles };
}

/**
 * Replace the tile at `cell` with `tile`. Out-of-bounds is a silent
 * no-op. Used by spectral/voucher arcana effects that mint a tile at a
 * specific spot — e.g. planting a wild.
 */
export function plantTile(board: Board, cell: Cell, tile: Tile): Board {
  if (!inBounds(board, cell)) return board;
  return withTile(board, cell, tile);
}

/**
 * Convert every plain tile of suit `from` to suit `to`, preserving the
 * tile id so the view animates the suit change in place rather than
 * popping the whole tile. Sparks and wilds keep their suit — converting
 * a special would muddle its visual meaning.
 */
export function convertSuit(board: Board, from: Suit, to: Suit): Board {
  if (from === to) return board;
  const tiles = board.tiles.map((t) =>
    t && !t.kind && t.suit === from ? { ...t, suit: to } : t,
  );
  return { ...board, tiles };
}

export function swapped(board: Board, a: Cell, b: Cell): Board {
  const tiles = board.tiles.slice();
  const ia = indexOf(board, a);
  const ib = indexOf(board, b);
  const tmp = tiles[ia] ?? null;
  tiles[ia] = tiles[ib] ?? null;
  tiles[ib] = tmp;
  return { ...board, tiles };
}

/**
 * Generate a board where no triples-on-spawn exist. We pick each cell's
 * suit while disallowing suits that would form an immediate match.
 */
export function generateBoard(
  rows: number,
  cols: number,
  rng: () => number,
): Board {
  const tiles: (Tile | null)[] = new Array(rows * cols).fill(null);
  const board: Board = { rows, cols, tiles };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const forbidden = new Set<Suit>();
      // Disallow horizontal triple: same suit at (row, col-1) and (row, col-2).
      if (col >= 2) {
        const a = tiles[row * cols + (col - 1)];
        const b = tiles[row * cols + (col - 2)];
        if (a && b && a.suit === b.suit) forbidden.add(a.suit);
      }
      // Disallow vertical triple.
      if (row >= 2) {
        const a = tiles[(row - 1) * cols + col];
        const b = tiles[(row - 2) * cols + col];
        if (a && b && a.suit === b.suit) forbidden.add(a.suit);
      }
      const choices = SUITS.filter((s) => !forbidden.has(s));
      const suit = rngPick(rng, choices);
      tiles[row * cols + col] = mintTile(suit);
    }
  }

  return board;
}

/** Mint a fresh tile for refill cascades. */
export function newTile(suit: Suit): Tile {
  return mintTile(suit);
}

/** True if any tile on the board is a spark or wild. The Emperor reads
 *  this — a "clean" board (all plain suits) earns the structure bonus. */
export function boardHasSpecials(board: Board): boolean {
  return board.tiles.some((t) => t !== null && t.kind !== undefined);
}

/**
 * Compute the set of cell indices that should render face-up under an
 * "obscure until adjacent to a special" boss restriction. A tile is
 * revealed when it is the named special OR orthogonally adjacent to
 * one. The result is keyed by board-tiles index so the view can look
 * each cell up in O(1).
 */
export function obscuredRevealSet(
  board: Board,
  special: "wild" | "spark",
): Set<number> {
  const revealed = new Set<number>();
  for (let row = 0; row < board.rows; row++) {
    for (let col = 0; col < board.cols; col++) {
      const idx = row * board.cols + col;
      const t = board.tiles[idx];
      if (!t || t.kind !== special) continue;
      revealed.add(idx);
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nc < 0 || nr >= board.rows || nc >= board.cols) continue;
        revealed.add(nr * board.cols + nc);
      }
    }
  }
  return revealed;
}
