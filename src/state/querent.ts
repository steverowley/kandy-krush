import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuerentClass } from "../game/querent";
import { useArcana } from "./arcana";
import { useMinorArcana } from "./minor-arcana";

export type QuerentRun = {
  classId: QuerentClass["id"];
  chamberIndex: number;
  totalScore: number;
  cleared: number;
  startedAt: number;
};

export type QuerentMeta = {
  runsCompleted: number;
  bestDepth: number;
  insight: number;
  unlocked: QuerentClass["id"][];
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
};

const DEFAULT_META: QuerentMeta = {
  runsCompleted: 0,
  bestDepth: 0,
  insight: 0,
  unlocked: ["seer"],
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
        set({
          run: {
            classId,
            chamberIndex: 1,
            totalScore: 0,
            cleared: 0,
            startedAt: Date.now(),
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
        set({ run: null, meta: nextMeta });
      },

      abandonRun: () => {
        useArcana.getState().reset();
        useMinorArcana.getState().reset();
        set({ run: null });
      },

      isUnlocked: (id) => get().meta.unlocked.includes(id),
    }),
    { name: "arcana.querent.v1" },
  ),
);
