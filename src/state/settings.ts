import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsState = {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  telemetry: boolean;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      sound: true,
      haptics: true,
      reducedMotion: false,
      telemetry: true,
      set: (patch) => set(patch),
    }),
    { name: "arcana.settings.v1" },
  ),
);
