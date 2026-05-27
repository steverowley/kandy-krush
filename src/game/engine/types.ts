/** The four minor-arcana suits. */
export type Suit = "cups" | "pentacles" | "swords" | "wands";

export const SUITS: readonly Suit[] = ["cups", "pentacles", "swords", "wands"];

/** Special-tile kinds.
 *  - "spark" — a match-4 leaves one of these in the middle. When the
 *    spark is later cleared as part of any match, it sweeps its row and
 *    column.
 *  - "wild" — a match-5+ leaves one of these in the middle. A wild
 *    counts as any suit when finding matches, but produces no special
 *    clear effect when itself swept.
 */
export type TileKind = "spark" | "wild";

/** A single tile occupying one cell of the board. */
export type Tile = {
  id: number;
  suit: Suit;
  kind?: TileKind;
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
