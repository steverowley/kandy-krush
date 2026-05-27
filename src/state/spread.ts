import { create } from "zustand";
import { persist } from "zustand/middleware";

type StarsByLevel = Record<number, 0 | 1 | 2 | 3>;

type SpreadState = {
  stars: StarsByLevel;
  recordResult: (levelId: number, stars: 0 | 1 | 2 | 3) => void;
  /** True if the level is unlocked. Level 1 is always unlocked; each
   *  subsequent level unlocks when the previous earned at least 1 star. */
  isUnlocked: (levelId: number) => boolean;
};

export const useSpread = create<SpreadState>()(
  persist(
    (set, get) => ({
      stars: {},
      recordResult: (levelId, stars) => {
        const prev = get().stars[levelId] ?? 0;
        if (stars > prev) {
          set({ stars: { ...get().stars, [levelId]: stars } });
        }
      },
      isUnlocked: (levelId) => {
        if (levelId <= 1) return true;
        const prev = get().stars[levelId - 1] ?? 0;
        return prev > 0;
      },
    }),
    { name: "arcana.spread.v1" },
  ),
);
