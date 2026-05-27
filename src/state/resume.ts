import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameSnapshot } from "./game";

/**
 * Mid-run save / restore for Spread and Querent. Daily already has its
 * own per-day snapshot under useDaily; this store handles the other
 * two persistent modes so leaving a chapter or chamber mid-run no
 * longer abandons your fortune.
 *
 * Keyed by mode + ordinal: "spread:3" for Spread chapter 3, or
 * "querent:5" for Querent chamber 5. A run is cleared on resolution
 * (win, loss, or explicit abandon).
 */

type Pending = Record<string, GameSnapshot>;

type State = {
  pending: Pending;
  saveSnapshot: (key: string, snapshot: GameSnapshot) => void;
  getSnapshot: (key: string) => GameSnapshot | undefined;
  clearSnapshot: (key: string) => void;
  /** Drop every snapshot whose mode matches — used when the player
   *  abandons a Querent run (every chamber's saved state goes too). */
  clearAllForMode: (mode: "spread" | "querent") => void;
};

export const useResume = create<State>()(
  persist(
    (set, get) => ({
      pending: {},
      saveSnapshot: (key, snapshot) =>
        set({ pending: { ...get().pending, [key]: snapshot } }),
      getSnapshot: (key) => get().pending[key],
      clearSnapshot: (key) => {
        const { [key]: _, ...rest } = get().pending;
        void _;
        set({ pending: rest });
      },
      clearAllForMode: (mode) => {
        const next: Pending = {};
        for (const [k, v] of Object.entries(get().pending)) {
          if (!k.startsWith(`${mode}:`)) next[k] = v;
        }
        set({ pending: next });
      },
    }),
    { name: "arcana.resume.v1" },
  ),
);

export function spreadKey(levelId: number): string {
  return `spread:${levelId}`;
}
export function querentKey(chamberIndex: number): string {
  return `querent:${chamberIndex}`;
}
