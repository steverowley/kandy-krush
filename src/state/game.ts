import { create } from "zustand";
import { newGame, tryMove, isDeadlocked } from "../game/engine/engine";
import { reserveTileIds } from "../game/engine/board";
import { createRng, type SeededRng } from "../game/engine/rng";
import type { Board, Cell, Suit, Tile } from "../game/engine/types";

export type GameMode = "free" | "spread" | "daily" | "querent";

export type ClearCounts = Record<Suit, number>;

const ZERO_CLEARED: ClearCounts = {
  cups: 0,
  pentacles: 0,
  swords: 0,
  wands: 0,
};

type GameState = {
  mode: GameMode;
  levelId: number | null;
  seed: number;
  board: Board;
  rng: SeededRng;
  score: number;
  moves: number;
  cleared: ClearCounts;
  /** Score multiplier applied to every cascade gain (Querent classes
   *  use this; other modes leave it at 1). */
  scoreMultiplier: number;
  selected: Cell | null;
  busy: boolean;
  deadlocked: boolean;
  nudge: number;
};

export type StartOpts = {
  seed?: number;
  rows?: number;
  cols?: number;
  levelId?: number;
  scoreMultiplier?: number;
};

/** Serializable snapshot of an in-progress run. The rng is captured as
 *  `seed` + `rngState`; on restore we recreate the closure and seek it
 *  to the saved state — so subsequent cascades draw the same tiles
 *  they would have drawn without the reload. */
export type GameSnapshot = {
  mode: GameMode;
  levelId: number | null;
  seed: number;
  rngState: number;
  rows: number;
  cols: number;
  tiles: Tile[];
  score: number;
  moves: number;
  cleared: ClearCounts;
};

type GameActions = {
  start: (mode: GameMode, opts?: StartOpts) => void;
  select: (cell: Cell | null) => void;
  attemptSwap: (a: Cell, b: Cell) => void;
  reset: () => void;
  snapshot: () => GameSnapshot;
  restore: (snap: GameSnapshot) => void;
};

const PLACEHOLDER_RNG = createRng(0);

export const useGame = create<GameState & GameActions>((set, get) => ({
  mode: "free",
  levelId: null,
  seed: 0,
  board: { rows: 0, cols: 0, tiles: [] },
  rng: PLACEHOLDER_RNG,
  score: 0,
  moves: 0,
  cleared: { ...ZERO_CLEARED },
  scoreMultiplier: 1,
  selected: null,
  busy: false,
  deadlocked: false,
  nudge: 0,

  start: (mode, opts) => {
    const rows = opts?.rows ?? 7;
    const cols = opts?.cols ?? 7;
    const seed = opts?.seed ?? Math.floor(Math.random() * 2 ** 31);
    const { board, rng } = newGame({ rows, cols, seed });
    set({
      mode,
      levelId: opts?.levelId ?? null,
      seed,
      board,
      rng,
      score: 0,
      moves: 0,
      cleared: { ...ZERO_CLEARED },
      scoreMultiplier: opts?.scoreMultiplier ?? 1,
      selected: null,
      busy: false,
      deadlocked: isDeadlocked(board),
      nudge: 0,
    });
  },

  select: (cell) => set({ selected: cell }),

  attemptSwap: (a, b) => {
    const s = get();
    if (s.busy) return;
    const result = tryMove(s.board, s.rng, a, b);
    if (!result) {
      set({ nudge: s.nudge + 1, selected: null });
      return;
    }
    const cleared: ClearCounts = { ...s.cleared };
    for (const step of result.cascades) {
      for (const group of step.matches) {
        cleared[group.suit] += group.cells.length;
      }
    }
    set({ busy: true });
    window.setTimeout(() => {
      set((prev) => ({
        board: result.board,
        score: prev.score + Math.round(result.scoreGained * prev.scoreMultiplier),
        moves: prev.moves + 1,
        cleared,
        selected: null,
        busy: false,
        deadlocked: isDeadlocked(result.board),
      }));
    }, 240);
  },

  reset: () => {
    const s = get();
    s.start(s.mode, s.levelId ? { levelId: s.levelId } : undefined);
  },

  snapshot: () => {
    const s = get();
    return {
      mode: s.mode,
      levelId: s.levelId,
      seed: s.seed,
      rngState: s.rng.state(),
      rows: s.board.rows,
      cols: s.board.cols,
      tiles: s.board.tiles.filter((t): t is Tile => !!t),
      score: s.score,
      moves: s.moves,
      cleared: { ...s.cleared },
    };
  },

  restore: (snap) => {
    const rng = createRng(snap.seed);
    rng.setState(snap.rngState);
    const board: Board = {
      rows: snap.rows,
      cols: snap.cols,
      tiles: snap.tiles.slice(),
    };
    let maxId = 0;
    for (const t of snap.tiles) if (t.id > maxId) maxId = t.id;
    reserveTileIds(maxId);
    set({
      mode: snap.mode,
      levelId: snap.levelId,
      seed: snap.seed,
      board,
      rng,
      score: snap.score,
      moves: snap.moves,
      cleared: { ...snap.cleared },
      selected: null,
      busy: false,
      deadlocked: isDeadlocked(board),
      nudge: 0,
    });
  },
}));
