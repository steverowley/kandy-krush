import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MAJOR_ARCANA,
  MAX_HELD_ARCANA,
  arcanaById,
  rollDraw,
  type Arcana,
  type ArcanaId,
} from "../game/arcana";
import { createRng } from "../game/engine/rng";

/**
 * Active Arcana state for the current run. Only persists `heldIds` and
 * `offeredIds` (strings) — the `Arcana` instances themselves are looked
 * up at read time so adding new effects to MAJOR_ARCANA is safe across
 * upgrades.
 *
 * Lives outside the engine: useGame.attemptSwap reads
 * `useArcana.getState().held()` at scoring time and applies effects to
 * each cascade step.
 */
type State = {
  heldIds: ArcanaId[];
  offeredIds: ArcanaId[];
  /** Last-resolved draw seed — used so the offer survives a navigation
   *  away and back without re-rolling into something different. */
  drawSeed: number;
  reset: () => void;
  /** Roll fresh offers, replacing any prior. `count` defaults to 3;
   *  stake rules can shrink it. */
  rollOffer: (seed?: number, count?: number) => void;
  /** Accept an offered arcana into a slot, then clear the offer. `cap`
   *  overrides MAX_HELD_ARCANA — stake rules can shrink the hand. */
  acceptOffer: (id: ArcanaId, cap?: number) => void;
  /** Skip the offer entirely. */
  skipOffer: () => void;
  /** Move the held arcana at `from` index to `to` index. Out-of-range
   *  indices or no-op moves return without mutating. Order is the firing
   *  order, so reordering is a meaningful strategic action. */
  reorder: (from: number, to: number) => void;
  /** Wheel of Fortune: sacrifice one held Major (random) and replace it
   *  with a random Major the player doesn't currently hold. Caller is
   *  responsible for the "once per chamber" gate via useGame. */
  wheelSwap: (rng?: () => number) => void;
  /** Convenience: hydrated readers. */
  held: () => Arcana[];
  offered: () => Arcana[];
  isFull: (cap?: number) => boolean;
};

export const useArcana = create<State>()(
  persist(
    (set, get) => ({
      heldIds: [],
      offeredIds: [],
      drawSeed: 0,

      reset: () => set({ heldIds: [], offeredIds: [], drawSeed: 0 }),

      rollOffer: (seed, count) => {
        const useSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
        const rng = createRng(useSeed);
        const held = get().held();
        const picks = rollDraw(MAJOR_ARCANA, held, rng, count ?? 3);
        set({ offeredIds: picks.map((a) => a.id), drawSeed: useSeed });
      },

      acceptOffer: (id, cap) => {
        const { heldIds } = get();
        const limit = cap ?? MAX_HELD_ARCANA;
        if (heldIds.length >= limit) {
          set({ offeredIds: [] });
          return;
        }
        if (heldIds.includes(id)) {
          set({ offeredIds: [] });
          return;
        }
        set({ heldIds: [...heldIds, id], offeredIds: [] });
      },

      skipOffer: () => set({ offeredIds: [] }),

      reorder: (from, to) => {
        const ids = get().heldIds;
        if (from === to) return;
        if (from < 0 || from >= ids.length) return;
        if (to < 0 || to >= ids.length) return;
        const next = ids.slice();
        const [moved] = next.splice(from, 1);
        if (!moved) return;
        next.splice(to, 0, moved);
        set({ heldIds: next });
      },

      wheelSwap: (rng) => {
        const ids = get().heldIds;
        if (ids.length === 0) return;
        const r = rng ?? Math.random;
        const heldSet = new Set(ids);
        const pool = MAJOR_ARCANA.filter((a) => !heldSet.has(a.id));
        if (pool.length === 0) return;
        const sacrificeIdx = Math.floor(r() * ids.length);
        const drawn = pool[Math.floor(r() * pool.length)]!;
        const next = ids.slice();
        next.splice(sacrificeIdx, 1, drawn.id);
        set({ heldIds: next });
      },

      held: () =>
        get()
          .heldIds.map((id) => arcanaById(id))
          .filter((a): a is Arcana => !!a),

      offered: () =>
        get()
          .offeredIds.map((id) => arcanaById(id))
          .filter((a): a is Arcana => !!a),

      isFull: (cap) => get().heldIds.length >= (cap ?? MAX_HELD_ARCANA),
    }),
    {
      name: "arcana.deck.v1",
      partialize: (s) => ({
        heldIds: s.heldIds,
        offeredIds: s.offeredIds,
        drawSeed: s.drawSeed,
      }),
    },
  ),
);
