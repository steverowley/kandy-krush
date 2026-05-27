import { create } from "zustand";
import { newGame, tryMove, isDeadlocked } from "../game/engine/engine";
import type { Board, Cell } from "../game/engine/types";

export type GameMode = "free" | "spread" | "daily" | "querent";

type RngFn = () => number;

type GameState = {
  mode: GameMode;
  board: Board;
  rng: RngFn;
  score: number;
  moves: number; // moves used (free play is endless; spread/daily limit elsewhere)
  selected: Cell | null;
  busy: boolean;
  deadlocked: boolean;
  /** A bumping counter the view increments on illegal swap so animations
   *  can react ("nudge / bounce"). */
  nudge: number;
};

type GameActions = {
  start: (mode: GameMode, opts?: { seed?: number; rows?: number; cols?: number }) => void;
  select: (cell: Cell | null) => void;
  attemptSwap: (a: Cell, b: Cell) => void;
  reset: () => void;
};

export const useGame = create<GameState & GameActions>((set, get) => ({
  mode: "free",
  board: { rows: 0, cols: 0, tiles: [] },
  rng: Math.random,
  score: 0,
  moves: 0,
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
      board,
      rng,
      score: 0,
      moves: 0,
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
    set({ busy: true });
    // The view drives an animation between the old board and result.board.
    // Reveal after a short delay so the swap reads as a real beat. The
    // delay is short but real — gameplay still feels responsive.
    window.setTimeout(() => {
      set((prev) => ({
        board: result.board,
        score: prev.score + result.scoreGained,
        moves: prev.moves + 1,
        selected: null,
        busy: false,
        deadlocked: isDeadlocked(result.board),
      }));
    }, 240);
  },

  reset: () => {
    const s = get();
    s.start(s.mode);
  },
}));
