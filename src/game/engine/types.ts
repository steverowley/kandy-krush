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
  /** True when at least one cell in the group was a wild tile at clear
   *  time. Read by arcana like The Star that reward wild-aware play. */
  hasWild?: boolean;
};

/** Result of resolving a swap. */
export type ResolveResult = {
  board: Board;
  cascades: CascadeStep[];
  /** Sum of every cascade step's score — chips × mult per step, then
   *  totalled. Already includes cascade-depth bonuses. */
  scoreGained: number;
  /** Sum of chip contributions across cascades — for HUD readout. */
  totalChips: number;
  /** Highest mult reached on any single cascade step — for HUD readout. */
  peakMult: number;
};

/** Per-wave breakdown of how a cascade step earned its score.
 *  Balatro-style: chips and mult are tracked separately, then multiplied
 *  at the end of the step. The product is what's added to the run total.
 */
export type CascadeStep = {
  matches: MatchGroup[];
  /** Cascade depth this step represents (1 = first wave). */
  depth: number;
  /** Base chips earned this step (sum of cleared cells' chip values plus
   *  spark blast bonuses). */
  chips: number;
  /** Mult applied to this step — sum of match-size bonuses plus a
   *  cascade-depth bonus (+1 per chain beyond the first). */
  mult: number;
  /** chips × mult, rounded — what gets added to the run total. */
  scoreGained: number;
};
