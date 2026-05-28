import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MAX_HELD_MINORS,
  MINOR_ARCANA,
  minorById,
  type MinorArcana,
  type MinorArcanaId,
} from "../game/minor-arcana";

/**
 * Held Minor Arcana state. Persists via Zustand so a mid-run refresh
 * survives. Grant flow: boss-chamber wins (in Play outcome handler).
 * Use flow: tap a badge in the Play consumables tray.
 */
type State = {
  heldIds: MinorArcanaId[];
  reset: () => void;
  /** Grant the named minor if there's room. `cap` overrides
   *  MAX_HELD_MINORS — Deeper Cup voucher raises the effective cap. */
  grant: (id: MinorArcanaId, cap?: number) => void;
  /** Grant a random Minor from the pool. Used as the boss-win reward. */
  grantRandom: (rng?: () => number, cap?: number) => MinorArcana | null;
  consume: (id: MinorArcanaId) => void;
  held: () => MinorArcana[];
  isFull: (cap?: number) => boolean;
};

export const useMinorArcana = create<State>()(
  persist(
    (set, get) => ({
      heldIds: [],

      reset: () => set({ heldIds: [] }),

      grant: (id, cap) => {
        const heldIds = get().heldIds;
        if (heldIds.length >= (cap ?? MAX_HELD_MINORS)) return;
        set({ heldIds: [...heldIds, id] });
      },

      grantRandom: (rng, cap) => {
        const heldIds = get().heldIds;
        if (heldIds.length >= (cap ?? MAX_HELD_MINORS)) return null;
        const rand = rng ?? Math.random;
        const pick = MINOR_ARCANA[Math.floor(rand() * MINOR_ARCANA.length)]!;
        set({ heldIds: [...heldIds, pick.id] });
        return pick;
      },

      consume: (id) => {
        const heldIds = get().heldIds;
        const idx = heldIds.indexOf(id);
        if (idx < 0) return;
        const next = heldIds.slice();
        next.splice(idx, 1);
        set({ heldIds: next });
      },

      held: () =>
        get()
          .heldIds.map((id) => minorById(id))
          .filter((m): m is MinorArcana => !!m),

      isFull: (cap) => get().heldIds.length >= (cap ?? MAX_HELD_MINORS),
    }),
    {
      name: "arcana.minor.v1",
      partialize: (s) => ({ heldIds: s.heldIds }),
    },
  ),
);
