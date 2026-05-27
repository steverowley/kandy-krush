import { create } from "zustand";
import { persist } from "zustand/middleware";

type TutorialState = {
  seen: boolean;
  markSeen: () => void;
  reset: () => void;
};

export const useTutorial = create<TutorialState>()(
  persist(
    (set) => ({
      seen: false,
      markSeen: () => set({ seen: true }),
      reset: () => set({ seen: false }),
    }),
    { name: "arcana.tutorial.v1" },
  ),
);
