/** The four minor-arcana suits. */
export type Suit = "cups" | "pentacles" | "swords" | "wands";

export const SUITS: readonly Suit[] = ["cups", "pentacles", "swords", "wands"];

/** A single tile occupying one cell of the board. */
export type Tile = {
  id: number;
  suit: Suit;
};

/** A 2D position on the board. */
export type Cell = { row: number; col: number };

/** The board is a row-major array of cells. `null` means an empty cell
 * during cascade — never present in a stable resting state. */
export type Board = {
  rows: number;
  cols: number;
  tiles: (Tile | null)[];
};

/** A swap of two adjacent cells. */
export type Swap = { a: Cell; b: Cell };

/** A group of matched cells (3+ in a row or column). */
export type MatchGroup = {
  suit: Suit;
  cells: Cell[];
};

/** Result of resolving a swap. */
export type ResolveResult = {
  board: Board;
  cascades: CascadeStep[];
  scoreGained: number;
};

export type CascadeStep = {
  matches: MatchGroup[];
  scoreGained: number;
};
