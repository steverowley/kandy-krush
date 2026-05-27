import { create } from "zustand";
import { newGame, tryMove, isDeadlocked } from "../game/engine/engine";
import type { Board, Cell, Suit } from "../game/engine/types";

export type GameMode = "free" | "spread" | "daily" | "querent";

type RngFn = () => number;

export type ClearCounts = Record<Suit, number>;

const ZERO_CLEARED: ClearCounts = {
  cups: 0,
  pentacles: 0,
  swords: 0,
  wands: 0,
};

type GameState = {
  mode: GameMode;
  /** For mode === "spread", which level is loaded. */
  levelId: number | null;
  board: Board;
  rng: RngFn;
  score: number;
  /** Moves the player has spent (only successful swaps count). */
  moves: number;
  /** Tiles cleared this run, broken out per suit. Mode-agnostic — modes
   *  that care about suit objectives read this. */
  cleared: ClearCounts;
  selected: Cell | null;
  busy: boolean;
  deadlocked: boolean;
  /** Bumping counter the view watches for illegal-swap nudges. */
  nudge: number;
};

export type StartOpts = {
  seed?: number;
  rows?: number;
  cols?: number;
  levelId?: number;
};

type GameActions = {
  start: (mode: GameMode, opts?: StartOpts) => void;
  select: (cell: Cell | null) => void;
  attemptSwap: (a: Cell, b: Cell) => void;
  reset: () => void;
};

export const useGame = create<GameState & GameActions>((set, get) => ({
  mode: "free",
  levelId: null,
  board: { rows: 0, cols: 0, tiles: [] },
  rng: Math.random,
  score: 0,
  moves: 0,
  cleared: { ...ZERO_CLEARED },
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
      board,
      rng,
      score: 0,
      moves: 0,
      cleared: { ...ZERO_CLEARED },
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
    // Tally cleared tiles per suit across every cascade step.
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
        score: prev.score + result.scoreGained,
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
}));
