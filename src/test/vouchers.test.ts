import { describe, expect, it, beforeEach } from "vitest";
import {
  VOUCHERS,
  aggregateVoucherEffects,
  voucherById,
} from "../game/vouchers";
import { useVouchers } from "../state/vouchers";

describe("VOUCHERS data", () => {
  it("ships the four starter vouchers", () => {
    expect(VOUCHERS.map((v) => v.id)).toEqual([
      "heavy-purse",
      "sixth-slot",
      "mystic-mirror",
      "deeper-cup",
    ]);
  });

  it("each voucher declares price + a non-empty description + flavor", () => {
    for (const v of VOUCHERS) {
      expect(v.price).toBeGreaterThan(0);
      expect(v.description.length).toBeGreaterThan(0);
      expect(v.flavor.length).toBeGreaterThan(0);
    }
  });

  it("each voucher's effect declares exactly one field", () => {
    for (const v of VOUCHERS) {
      const keys = Object.keys(v.effect).filter(
        (k) => (v.effect as Record<string, unknown>)[k] !== undefined,
      );
      expect(keys.length).toBe(1);
    }
  });
});

describe("voucherById", () => {
  it("returns the matching voucher", () => {
    expect(voucherById("heavy-purse")?.name).toBe("Heavy Purse");
  });
  it("returns undefined for unknown ids", () => {
    expect(voucherById("nope" as never)).toBeUndefined();
  });
});

describe("aggregateVoucherEffects", () => {
  it("returns zeros for an empty owned list", () => {
    expect(aggregateVoucherEffects([])).toEqual({
      coinBonus: 0,
      handCapBonus: 0,
      minorCapBonus: 0,
      freeRerolls: 0,
    });
  });

  it("sums each voucher's contribution", () => {
    const owned = [
      voucherById("heavy-purse")!,
      voucherById("sixth-slot")!,
      voucherById("mystic-mirror")!,
      voucherById("deeper-cup")!,
    ];
    const totals = aggregateVoucherEffects(owned);
    expect(totals.coinBonus).toBe(2);
    expect(totals.handCapBonus).toBe(1);
    expect(totals.minorCapBonus).toBe(1);
    expect(totals.freeRerolls).toBe(1);
  });
});

describe("useVouchers store", () => {
  beforeEach(() => {
    useVouchers.getState().reset();
  });

  it("starts empty", () => {
    expect(useVouchers.getState().ownedIds).toEqual([]);
  });

  it("buy adds the voucher; double-buy is a no-op", () => {
    useVouchers.getState().buy("heavy-purse");
    useVouchers.getState().buy("heavy-purse");
    expect(useVouchers.getState().ownedIds).toEqual(["heavy-purse"]);
  });

  it("isOwned reflects buy", () => {
    expect(useVouchers.getState().isOwned("sixth-slot")).toBe(false);
    useVouchers.getState().buy("sixth-slot");
    expect(useVouchers.getState().isOwned("sixth-slot")).toBe(true);
  });

  it("available() excludes owned vouchers", () => {
    useVouchers.getState().buy("heavy-purse");
    const ids = useVouchers.getState().available().map((v) => v.id);
    expect(ids).not.toContain("heavy-purse");
    expect(ids.length).toBe(VOUCHERS.length - 1);
  });

  it("reset clears the owned list", () => {
    useVouchers.getState().buy("mystic-mirror");
    useVouchers.getState().buy("deeper-cup");
    useVouchers.getState().reset();
    expect(useVouchers.getState().ownedIds).toEqual([]);
  });
});
