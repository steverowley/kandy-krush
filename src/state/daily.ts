import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameSnapshot } from "./game";

export type DailyOutcome = "in-progress" | "won" | "lost";

export type DailyRun = {
  key: string;
  outcome: DailyOutcome;
  finalScore: number;
  /** Snapshot of the in-progress run for mid-day resume. Cleared once
   *  the day resolves. */
  snapshot: GameSnapshot | null;
};

type DailyState = {
  /** Keyed by YYYY-MM-DD. Yesterday and earlier are preserved so the
   *  player can scroll a small history. */
  runs: Record<string, DailyRun>;
  getRun: (key: string) => DailyRun | undefined;
  saveSnapshot: (key: string, snapshot: GameSnapshot) => void;
  finishRun: (key: string, outcome: "won" | "lost", finalScore: number) => void;
};

export const useDaily = create<DailyState>()(
  persist(
    (set, get) => ({
      runs: {},
      getRun: (key) => get().runs[key],
      saveSnapshot: (key, snapshot) => {
        const prev = get().runs[key];
        if (prev && prev.outcome !== "in-progress") return; // finished — don't trample
        set({
          runs: {
            ...get().runs,
            [key]: {
              key,
              outcome: "in-progress",
              finalScore: prev?.finalScore ?? 0,
              snapshot,
            },
          },
        });
      },
      finishRun: (key, outcome, finalScore) => {
        const prev = get().runs[key];
        if (prev && prev.outcome !== "in-progress") return; // already final
        set({
          runs: {
            ...get().runs,
            [key]: {
              key,
              outcome,
              finalScore,
              snapshot: null,
            },
          },
        });
      },
    }),
    { name: "arcana.daily.v1" },
  ),
);
