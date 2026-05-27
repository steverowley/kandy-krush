import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuerentClass } from "../game/querent";
import { useArcana } from "./arcana";
import { useMinorArcana } from "./minor-arcana";
import {
  DEFAULT_STAKE,
  nextStakeAfter,
  stakeById,
  type StakeId,
} from "../game/stakes";

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
        set({
          run: {
            ...r,
            chamberIndex: r.chamberIndex + 1,
            totalScore: r.totalScore + gained,
            cleared: r.cleared + 1,
          },
          meta: { ...meta, bestDepth: newDepth },
        });
      },

      failRun: () => {
        const r = get().run;
        const meta = get().meta;
        useArcana.getState().reset();
        useMinorArcana.getState().reset();
        if (!r) {
          set({ run: null });
          return;
        }
        let nextMeta: QuerentMeta = {
          ...meta,
          insight: meta.insight + r.totalScore,
        };
        nextMeta = ensureUnlocked(nextMeta, "maker");
        set({ run: null, meta: nextMeta });
      },

      finishRun: () => {
        const r = get().run;
        const meta = get().meta;
        useArcana.getState().reset();
        useMinorArcana.getState().reset();
        if (!r) {
          set({ run: null });
          return;
        }
        let nextMeta: QuerentMeta = {
          ...meta,
          runsCompleted: meta.runsCompleted + 1,
          insight: meta.insight + r.totalScore,
          bestDepth: Math.max(meta.bestDepth, r.chamberIndex),
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
      version: 2,
      migrate: (persisted, version) => {
        // v1 → v2 introduces stake unlocks. Inject the defaults if
        // they're missing so existing players don't load broken state.
        const state = persisted as { meta?: Partial<QuerentMeta> } | undefined;
        if (state?.meta && version < 2) {
          state.meta = {
            ...DEFAULT_META,
            ...state.meta,
            maxStakeId: state.meta.maxStakeId ?? DEFAULT_STAKE,
            currentStakeId: state.meta.currentStakeId ?? DEFAULT_STAKE,
          };
        }
        return persisted as never;
      },
    },
  ),
);
