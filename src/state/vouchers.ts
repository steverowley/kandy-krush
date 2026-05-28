import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  VOUCHERS,
  voucherById,
  type Voucher,
  type VoucherId,
} from "../game/vouchers";

/**
 * Owned Vouchers for the current run. Persists across reloads so a mid-
 * run refresh doesn't wipe paid-for upgrades. useQuerent.reset path
 * clears this on every run boundary.
 */
type State = {
  ownedIds: VoucherId[];
  reset: () => void;
  buy: (id: VoucherId) => void;
  isOwned: (id: VoucherId) => boolean;
  owned: () => Voucher[];
  /** All vouchers not yet owned — the random-offer pool. */
  available: () => Voucher[];
};

export const useVouchers = create<State>()(
  persist(
    (set, get) => ({
      ownedIds: [],

      reset: () => set({ ownedIds: [] }),

      buy: (id) => {
        const ids = get().ownedIds;
        if (ids.includes(id)) return;
        set({ ownedIds: [...ids, id] });
      },

      isOwned: (id) => get().ownedIds.includes(id),

      owned: () =>
        get()
          .ownedIds.map((id) => voucherById(id))
          .filter((v): v is Voucher => !!v),

      available: () => {
        const owned = new Set(get().ownedIds);
        return VOUCHERS.filter((v) => !owned.has(v.id));
      },
    }),
    {
      name: "arcana.vouchers.v1",
      partialize: (s) => ({ ownedIds: s.ownedIds }),
    },
  ),
);
