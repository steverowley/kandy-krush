import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsState = {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      sound: true,
      haptics: true,
      reducedMotion: false,
      set: (patch) => set(patch),
    }),
    { name: "arcana.settings.v1" },
  ),
);
