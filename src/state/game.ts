import { create } from "zustand";
import { newGame, tryMove, isDeadlocked } from "../game/engine/engine";
import { reserveTileIds } from "../game/engine/board";
import { destroyCells } from "../game/engine/cascade";
import { createRng, type SeededRng } from "../game/engine/rng";
import type { Board, CascadeStep, Cell, Suit, Tile } from "../game/engine/types";
import {
  applyArcanaToStep,
  MAX_HELD_ARCANA,
  silenceSuitInStep,
  type Arcana,
} from "../game/arcana";
import { useArcana } from "./arcana";
import { useMinorArcana } from "./minor-arcana";
import type { ChamberRestriction } from "../game/querent";
import type { StakeRule } from "../game/stakes";

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
  /** Active stake's qualitative rule, if any. */
  stakeRule: StakeRule | null;
  /** Per-move score multiplier set by Minor Arcana consumables (e.g.
   *  Page of Wands). Defaults to 1; resets back to 1 after the next
   *  scored move applies it. */
  nextMoveScoreMul: number;
  /** Per-move mult multiplier (Queen of Wands). Defaults to 1; resets
   *  to 1 after the next scored move applies it. */
  nextMoveMultMul: number;
  /** Per-move flat chips bonus (King of Pentacles). Defaults to 0;
   *  resets to 0 after the next scored move applies it. */
  nextMoveChipsBonus: number;
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
  stakeRule?: StakeRule | null;
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
  /** Imperative side-effect from a Minor Arcana consumable. */
  grantMoves: (n: number) => void;
  grantScore: (n: number) => void;
  armNextMoveMul: (mul: number) => void;
  armNextMoveMultMul: (mul: number) => void;
  armNextMoveChipsBonus: (chips: number) => void;
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
  stakeRule: null,
  nextMoveScoreMul: 1,
  nextMoveMultMul: 1,
  nextMoveChipsBonus: 0,
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
      stakeRule: opts?.stakeRule ?? null,
      nextMoveScoreMul: 1,
      nextMoveMultMul: 1,
      nextMoveChipsBonus: 0,
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
    set({ busy: true });
    window.setTimeout(() => {
      set((prev) => {
        // Apply held Arcana effects per cascade step, plus any Boss
        // Blind restriction on the chamber. Restriction silencing runs
        // BEFORE arcana so silenced suits don't trigger suit-keyed
        // bonuses; halveArcana is forwarded into applyArcanaToStep so
        // it can scale only the arcana delta, not the engine base.
        const held = useArcana.getState().held();
        const minorHeldCount = useMinorArcana.getState().held().length;
        const restriction = prev.restriction;
        const stakeRule = prev.stakeRule;
        const maxHand = stakeRule?.maxHand ?? MAX_HELD_ARCANA;

        // The "warmup tax" — Gold stake silences the first scoring step
        // of every move. The first call to scoreSteps marks the first
        // step as silenced; later calls (e.g. Death's post-move cascade)
        // never trigger the silence since the silence flag is per-move.
        let firstStepSilenced = false;

        // King of Pentacles fires a flat chip bonus on the first SCORED
        // step of the move (so silenced step 1 doesn't burn it). The
        // closure tracks the remaining bonus so it fires once.
        let chipsBonusRemaining = prev.nextMoveChipsBonus;
        const multMul = prev.nextMoveMultMul;

        const scoreSteps = (
          steps: readonly CascadeStep[],
          acc: { score: number; chips: number; peakMult: number },
        ) => {
          for (const rawStep of steps) {
            const silenceThisStep =
              stakeRule?.silenceFirstMatch && !firstStepSilenced;
            if (silenceThisStep) firstStepSilenced = true;
            if (silenceThisStep) continue;
            const step = restriction?.silenceSuit
              ? silenceSuitInStep(rawStep, restriction.silenceSuit)
              : rawStep;
            const modified = applyArcanaToStep(step, held, {
              depth: step.depth,
              movesUsed: prev.moves,
              totalMoves: prev.totalMoves,
              halveArcana: restriction?.halveArcana ?? false,
              isBoss: restriction !== null,
              maxHand,
              minorHeldCount,
            });
            // Minor consumable post-arcana modifiers: King's flat chips
            // bonus (one-shot, first scored step only) and Queen of
            // Wands's mult multiplier (every step of this move).
            let effChips = modified.chips;
            if (chipsBonusRemaining > 0) {
              effChips += chipsBonusRemaining;
              chipsBonusRemaining = 0;
            }
            const effMult = Math.round(modified.mult * multMul);
            const effScore = effChips * effMult;
            acc.score += effScore;
            acc.chips += effChips;
            if (effMult > acc.peakMult) acc.peakMult = effMult;
          }
        };

        const totals = { score: 0, chips: 0, peakMult: 0 };
        scoreSteps(result.cascades, totals);

        const cleared: ClearCounts = { ...prev.cleared };
        for (const step of result.cascades) {
          for (const group of step.matches) {
            cleared[group.suit] += group.cells.length;
          }
        }

        // Imperative board-modifying arcana fire once per move, after
        // the swap's cascade has settled. Each hook's resulting refill-
        // cascade is folded into the same move's score and cleared
        // counts — so Death's destruction stacks on top of the swap.
        let board = result.board;
        for (const arcana of held as readonly Arcana[]) {
          if (!arcana.postMove) continue;
          const cells = arcana.postMove(board, prev.rng);
          if (cells.length === 0) continue;
          const destroyed = destroyCells(board, prev.rng, cells);
          board = destroyed.board;
          scoreSteps(destroyed.cascades, totals);
          for (const step of destroyed.cascades) {
            for (const group of step.matches) {
              cleared[group.suit] += group.cells.length;
            }
          }
        }

        const scored = Math.round(
          totals.score * prev.scoreMultiplier * prev.nextMoveScoreMul,
        );
        return {
          board,
          score: prev.score + scored,
          moves: prev.moves + 1,
          cleared,
          // Per-move minor-arcana buffs all fire exactly once and clear.
          nextMoveScoreMul: 1,
          nextMoveMultMul: 1,
          nextMoveChipsBonus: 0,
          lastMove: {
            chips: totals.chips,
            mult: totals.peakMult,
            score: scored,
            tick: prev.lastMove.tick + 1,
          },
          selected: null,
          busy: false,
          deadlocked: isDeadlocked(board),
        };
      });
    }, 240);
  },

  reset: () => {
    const s = get();
    s.start(s.mode, s.levelId ? { levelId: s.levelId } : undefined);
  },

  grantMoves: (n) => {
    const s = get();
    if (s.totalMoves === null) return;
    set({ totalMoves: s.totalMoves + n });
  },

  grantScore: (n) =>
    set((s) => ({ score: s.score + Math.max(0, Math.round(n)) })),

  armNextMoveMul: (mul) => set({ nextMoveScoreMul: Math.max(1, mul) }),
  armNextMoveMultMul: (mul) => set({ nextMoveMultMul: Math.max(1, mul) }),
  armNextMoveChipsBonus: (chips) =>
    set({ nextMoveChipsBonus: Math.max(0, Math.round(chips)) }),

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
      nextMoveScoreMul: 1,
      lastMove: { ...ZERO_LAST_MOVE },
      selected: null,
      busy: false,
      deadlocked: isDeadlocked(board),
      nudge: 0,
    });
  },
}));
