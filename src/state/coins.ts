import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Coin economy state. Coins are run-scoped — earned by clearing
 * chambers, spent in the Parlour. `useQuerent` resets this on every
 * run boundary so a new path starts with an empty purse.
 *
 * Persists across reloads so a mid-run refresh doesn't wipe earnings.
 */
type State = {
  balance: number;
  reset: () => void;
  grant: (n: number) => void;
  /** Attempt to spend `n`. Returns true on success, false if balance
   *  was insufficient (in which case state is unchanged). */
  spend: (n: number) => boolean;
};

export const useCoins = create<State>()(
  persist(
    (set, get) => ({
      balance: 0,

      reset: () => set({ balance: 0 }),

      grant: (n) => {
        if (n <= 0) return;
        set((s) => ({ balance: s.balance + Math.round(n) }));
      },

      spend: (n) => {
        if (n <= 0) return true;
        const cur = get().balance;
        if (cur < n) return false;
        set({ balance: cur - Math.round(n) });
        return true;
      },
    }),
    {
      name: "arcana.coins.v1",
      partialize: (s) => ({ balance: s.balance }),
    },
  ),
);
