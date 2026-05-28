import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuerentClass } from "../game/querent";
import { useArcana } from "./arcana";
import { useMinorArcana } from "./minor-arcana";
import { useCoins } from "./coins";
import { useVouchers } from "./vouchers";
import {
  DEFAULT_STAKE,
  nextStakeAfter,
  stakeById,
  type StakeId,
} from "../game/stakes";

/** A single-stake leaderboard: did the player ever clear at this tier,
 *  what was their peak score, what was their deepest chamber, and how
 *  many full clears do they have. Updated by passChamber / failRun /
 *  finishRun. */
export type StakeRecord = {
  cleared: boolean;
  bestScore: number;
  bestDepth: number;
  runsCompleted: number;
};

function emptyRecord(): StakeRecord {
  return { cleared: false, bestScore: 0, bestDepth: 0, runsCompleted: 0 };
}

function updatedRecord(
  prev: StakeRecord | undefined,
  patch: Partial<StakeRecord>,
): StakeRecord {
  const base = prev ?? emptyRecord();
  return {
    cleared: patch.cleared ?? base.cleared,
    bestScore: Math.max(base.bestScore, patch.bestScore ?? 0),
    bestDepth: Math.max(base.bestDepth, patch.bestDepth ?? 0),
    runsCompleted: base.runsCompleted + (patch.runsCompleted ?? 0),
  };
}

export type QuerentRun = {
  classId: QuerentClass["id"];
  chamberIndex: number;
  totalScore: number;
  cleared: number;
  startedAt: number;
  /** Stake the run was begun at — locked in so changing the lobby
   *  selector mid-run doesn't retroactively re-tune chambers. */
  stakeId: StakeId;
};

export type QuerentMeta = {
  runsCompleted: number;
  bestDepth: number;
  insight: number;
  unlocked: QuerentClass["id"][];
  /** Highest unlocked stake — players can pick any stake from 0..this. */
  maxStakeId: StakeId;
  /** Stake the lobby is currently primed at. Defaults to whatever the
   *  player last picked; clamped to maxStakeId on read. */
  currentStakeId: StakeId;
  /** Per-stake bests, accumulated across runs. Stakes the player has
   *  never started are absent from the map. */
  records: Partial<Record<StakeId, StakeRecord>>;
};

type State = {
  run: QuerentRun | null;
  meta: QuerentMeta;
  beginRun: (classId: QuerentClass["id"]) => void;
  passChamber: (gained: number) => void;
  failRun: () => void;
  finishRun: () => void;
  abandonRun: () => void;
  isUnlocked: (classId: QuerentClass["id"]) => boolean;
  setStake: (id: StakeId) => void;
};

const DEFAULT_META: QuerentMeta = {
  runsCompleted: 0,
  bestDepth: 0,
  insight: 0,
  unlocked: ["seer"],
  maxStakeId: DEFAULT_STAKE,
  currentStakeId: DEFAULT_STAKE,
  records: {},
};

function ensureUnlocked(meta: QuerentMeta, id: QuerentClass["id"]): QuerentMeta {
  if (meta.unlocked.includes(id)) return meta;
  return { ...meta, unlocked: [...meta.unlocked, id] };
}

export const useQuerent = create<State>()(
  persist(
    (set, get) => ({
      run: null,
      meta: DEFAULT_META,

      beginRun: (classId) => {
        // Fresh run gets a fresh Arcana deck.
        useArcana.getState().reset();
        useMinorArcana.getState().reset();
        useCoins.getState().reset();
        useVouchers.getState().reset();
        const meta = get().meta;
        set({
          run: {
            classId,
            chamberIndex: 1,
            totalScore: 0,
            cleared: 0,
            startedAt: Date.now(),
            stakeId: meta.currentStakeId,
          },
        });
      },

      passChamber: (gained) => {
        const r = get().run;
        if (!r) return;
        const meta = get().meta;
        const newDepth = Math.max(meta.bestDepth, r.chamberIndex);
        const records = {
          ...meta.records,
          [r.stakeId]: updatedRecord(meta.records[r.stakeId], {
            bestDepth: r.chamberIndex,
          }),
        };
        set({
          run: {
            ...r,
            chamberIndex: r.chamberIndex + 1,
            totalScore: r.totalScore + gained,
            cleared: r.cleared + 1,
          },
          meta: { ...meta, bestDepth: newDepth, records },
        });
      },

      failRun: () => {
        const r = get().run;
        const meta = get().meta;
        useArcana.getState().reset();
        useMinorArcana.getState().reset();
        useCoins.getState().reset();
        useVouchers.getState().reset();
        if (!r) {
          set({ run: null });
          return;
        }
        const records = {
          ...meta.records,
          [r.stakeId]: updatedRecord(meta.records[r.stakeId], {
            bestScore: r.totalScore,
          }),
        };
        let nextMeta: QuerentMeta = {
          ...meta,
          insight: meta.insight + r.totalScore,
          records,
        };
        nextMeta = ensureUnlocked(nextMeta, "maker");
        set({ run: null, meta: nextMeta });
      },

      finishRun: () => {
        const r = get().run;
        const meta = get().meta;
        useArcana.getState().reset();
        useMinorArcana.getState().reset();
        useCoins.getState().reset();
        useVouchers.getState().reset();
        if (!r) {
          set({ run: null });
          return;
        }
        const records = {
          ...meta.records,
          [r.stakeId]: updatedRecord(meta.records[r.stakeId], {
            cleared: true,
            bestScore: r.totalScore,
            bestDepth: r.chamberIndex,
            runsCompleted: 1,
          }),
        };
        let nextMeta: QuerentMeta = {
          ...meta,
          runsCompleted: meta.runsCompleted + 1,
          insight: meta.insight + r.totalScore,
          bestDepth: Math.max(meta.bestDepth, r.chamberIndex),
          records,
        };
        nextMeta = ensureUnlocked(nextMeta, "maker");
        nextMeta = ensureUnlocked(nextMeta, "walker");
        // Beating the current max stake unlocks the next tier (and
        // primes the lobby selector at the new max so subsequent runs
        // default to the harder difficulty).
        if (r.stakeId === nextMeta.maxStakeId) {
          const next = nextStakeAfter(nextMeta.maxStakeId);
          if (next) {
            nextMeta.maxStakeId = next.id;
            nextMeta.currentStakeId = next.id;
          }
        }
        set({ run: null, meta: nextMeta });
      },

      abandonRun: () => {
        useArcana.getState().reset();
        useMinorArcana.getState().reset();
        useCoins.getState().reset();
        useVouchers.getState().reset();
        set({ run: null });
      },

      isUnlocked: (id) => get().meta.unlocked.includes(id),

      setStake: (id) => {
        const meta = get().meta;
        const target = stakeById(id);
        const max = stakeById(meta.maxStakeId);
        if (!target || !max) return;
        // Can't select a stake the player hasn't unlocked yet.
        if (target.tier > max.tier) return;
        set({ meta: { ...meta, currentStakeId: id } });
      },
    }),
    {
      name: "arcana.querent.v1",
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as { meta?: Partial<QuerentMeta> } | undefined;
        if (state?.meta && version < 2) {
          // v1 → v2 introduces stake unlocks. Inject the defaults if
          // they're missing so existing players don't load broken state.
          state.meta = {
            ...DEFAULT_META,
            ...state.meta,
            maxStakeId: state.meta.maxStakeId ?? DEFAULT_STAKE,
            currentStakeId: state.meta.currentStakeId ?? DEFAULT_STAKE,
          };
        }
        if (state?.meta && version < 3) {
          // v2 → v3 introduces per-stake records. Seed `white` from the
          // existing aggregate stats so prior progress shows up under
          // the only stake older saves could possibly have played.
          const m = state.meta;
          state.meta = {
            ...m,
            records: m.records ?? {
              white: {
                cleared: (m.runsCompleted ?? 0) > 0,
                bestScore: 0,
                bestDepth: m.bestDepth ?? 0,
                runsCompleted: m.runsCompleted ?? 0,
              },
            },
          };
        }
        return persisted as never;
      },
    },
  ),
);
