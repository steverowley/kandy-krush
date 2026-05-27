import { create } from "zustand";
import { newGame, tryMove, isDeadlocked } from "../game/engine/engine";
import { reserveTileIds } from "../game/engine/board";
import { createRng, type SeededRng } from "../game/engine/rng";
import type { Board, Cell, Suit, Tile } from "../game/engine/types";
import { applyArcanaToStep, silenceSuitInStep } from "../game/arcana";
import { useArcana } from "./arcana";
import type { ChamberRestriction } from "../game/querent";

export type GameMode = "free" | "spread" | "daily" | "querent";

export type ClearCounts = Record<Suit, number>;

const ZERO_CLEARED: ClearCounts = {
  cups: 0,
  pentacles: 0,
  swords: 0,
  wands: 0,
};

/** Most-recent settled-move scoring breakdown for the HUD. Reset to all
 *  zeros at run start; updated atomically with `score` on every resolve.
 *  `tick` increments each time so HUD effects can re-trigger even on
 *  identical chip/mult totals. */
export type LastMoveScore = {
  chips: number;
  mult: number;
  score: number;
  tick: number;
};

const ZERO_LAST_MOVE: LastMoveScore = { chips: 0, mult: 0, score: 0, tick: 0 };

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
  /** Total move budget for the current blind, if known. Used by arcana
   *  whose effects depend on chamber pacing (e.g. The World). */
  totalMoves: number | null;
  /** Active Boss Blind restriction, if this blind is a boss. */
  restriction: ChamberRestriction | null;
  lastMove: LastMoveScore;
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
  totalMoves?: number;
  restriction?: ChamberRestriction | null;
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
  totalMoves: null,
  restriction: null,
  lastMove: { ...ZERO_LAST_MOVE },
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
      totalMoves: opts?.totalMoves ?? null,
      restriction: opts?.restriction ?? null,
      lastMove: { ...ZERO_LAST_MOVE },
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
      set((prev) => {
        // Apply held Arcana effects per cascade step, plus any Boss
        // Blind restriction on the chamber. Restriction silencing runs
        // BEFORE arcana so silenced suits don't trigger suit-keyed
        // bonuses; halveArcana is forwarded into applyArcanaToStep so
        // it can scale only the arcana delta, not the engine base.
        const held = useArcana.getState().held();
        const restriction = prev.restriction;
        let modTotalScore = 0;
        let modTotalChips = 0;
        let modPeakMult = 0;
        for (const rawStep of result.cascades) {
          const step = restriction?.silenceSuit
            ? silenceSuitInStep(rawStep, restriction.silenceSuit)
            : rawStep;
          const modified = applyArcanaToStep(step, held, {
            depth: step.depth,
            movesUsed: prev.moves,
            totalMoves: prev.totalMoves,
            halveArcana: restriction?.halveArcana ?? false,
          });
          modTotalScore += modified.scoreGained;
          modTotalChips += modified.chips;
          if (modified.mult > modPeakMult) modPeakMult = modified.mult;
        }
        const scored = Math.round(modTotalScore * prev.scoreMultiplier);
        return {
          board: result.board,
          score: prev.score + scored,
          moves: prev.moves + 1,
          cleared,
          lastMove: {
            chips: modTotalChips,
            mult: modPeakMult,
            score: scored,
            tick: prev.lastMove.tick + 1,
          },
          selected: null,
          busy: false,
          deadlocked: isDeadlocked(result.board),
        };
      });
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
      lastMove: { ...ZERO_LAST_MOVE },
      selected: null,
      busy: false,
      deadlocked: isDeadlocked(board),
      nudge: 0,
    });
  },
}));
