import { describe, expect, it, beforeEach } from "vitest";
import {
  ARCANA_PRICE,
  COINS_PER_BOSS,
  COINS_PER_CHAMBER,
  MINOR_PRICE,
  MINOR_OFFER_CHANCE,
  PARLOUR_CHAMBERS,
  PARLOUR_OFFER_COUNT,
  REROLL_PRICE,
  coinsForChamber,
  isParlourChamber,
  priceOf,
  rollMixedOffers,
  rollParlourOffers,
} from "../game/parlour";
import { useCoins } from "../state/coins";
import { MAJOR_ARCANA } from "../game/arcana";
import { createRng } from "../game/engine/rng";

describe("isParlourChamber", () => {
  it("flags the chambers declared in PARLOUR_CHAMBERS", () => {
    for (const idx of PARLOUR_CHAMBERS) {
      expect(isParlourChamber(idx)).toBe(true);
    }
  });
  it("is false for chambers outside the list", () => {
    expect(isParlourChamber(1)).toBe(false);
    expect(isParlourChamber(13)).toBe(false);
  });
});

describe("coinsForChamber", () => {
  it("pays the base for a non-boss win", () => {
    expect(coinsForChamber({ isBoss: false })).toBe(COINS_PER_CHAMBER);
  });
  it("pays the base + boss bonus for a boss win", () => {
    expect(coinsForChamber({ isBoss: true })).toBe(
      COINS_PER_CHAMBER + COINS_PER_BOSS,
    );
  });
});

describe("rollParlourOffers", () => {
  it("returns PARLOUR_OFFER_COUNT offers by default", () => {
    const offers = rollParlourOffers([], createRng(1));
    expect(offers).toHaveLength(PARLOUR_OFFER_COUNT);
  });
  it("excludes arcana the player already holds", () => {
    const held = [MAJOR_ARCANA[0]!, MAJOR_ARCANA[1]!];
    const offers = rollParlourOffers(held, createRng(1));
    const offerIds = offers.map((a) => a.id);
    for (const h of held) {
      expect(offerIds).not.toContain(h.id);
    }
  });
  it("is deterministic when given the same seed", () => {
    const a = rollParlourOffers([], createRng(42));
    const b = rollParlourOffers([], createRng(42));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
});

describe("useCoins store", () => {
  beforeEach(() => {
    useCoins.getState().reset();
  });

  it("starts at zero", () => {
    expect(useCoins.getState().balance).toBe(0);
  });

  it("grant adds to the balance", () => {
    useCoins.getState().grant(5);
    expect(useCoins.getState().balance).toBe(5);
    useCoins.getState().grant(3);
    expect(useCoins.getState().balance).toBe(8);
  });

  it("grant ignores non-positive amounts", () => {
    useCoins.getState().grant(-3);
    useCoins.getState().grant(0);
    expect(useCoins.getState().balance).toBe(0);
  });

  it("spend deducts when the balance is sufficient", () => {
    useCoins.getState().grant(10);
    const ok = useCoins.getState().spend(6);
    expect(ok).toBe(true);
    expect(useCoins.getState().balance).toBe(4);
  });

  it("spend returns false and leaves the balance untouched when too poor", () => {
    useCoins.getState().grant(3);
    const ok = useCoins.getState().spend(5);
    expect(ok).toBe(false);
    expect(useCoins.getState().balance).toBe(3);
  });

  it("spend treats zero/negative as a free no-op success", () => {
    expect(useCoins.getState().spend(0)).toBe(true);
    expect(useCoins.getState().spend(-1)).toBe(true);
    expect(useCoins.getState().balance).toBe(0);
  });

  it("reset clears the balance", () => {
    useCoins.getState().grant(100);
    useCoins.getState().reset();
    expect(useCoins.getState().balance).toBe(0);
  });
});

describe("Parlour pricing sanity", () => {
  it("ARCANA_PRICE is reasonable given chamber coin payout", () => {
    // Average ~2 chamber wins (10 coins) should afford 1 arcana.
    expect(ARCANA_PRICE).toBeGreaterThan(0);
    expect(ARCANA_PRICE).toBeLessThanOrEqual(2 * COINS_PER_CHAMBER);
  });

  it("MINOR_PRICE is strictly cheaper than ARCANA_PRICE", () => {
    expect(MINOR_PRICE).toBeLessThan(ARCANA_PRICE);
  });

  it("REROLL_PRICE is affordable from a single chamber win", () => {
    expect(REROLL_PRICE).toBeGreaterThan(0);
    expect(REROLL_PRICE).toBeLessThanOrEqual(COINS_PER_CHAMBER);
  });

  it("MINOR_OFFER_CHANCE sits between 0 and 1", () => {
    expect(MINOR_OFFER_CHANCE).toBeGreaterThan(0);
    expect(MINOR_OFFER_CHANCE).toBeLessThan(1);
  });
});

describe("rollMixedOffers", () => {
  it("returns the requested count of offers", () => {
    const offers = rollMixedOffers([], createRng(1));
    expect(offers).toHaveLength(PARLOUR_OFFER_COUNT);
  });

  it("each offer is either major or minor (typed discriminator)", () => {
    const offers = rollMixedOffers([], createRng(42), 4);
    for (const o of offers) {
      expect(o.kind === "major" || o.kind === "minor").toBe(true);
    }
  });

  it("excludes major arcana the player already holds", () => {
    const held = [MAJOR_ARCANA[0]!, MAJOR_ARCANA[1]!, MAJOR_ARCANA[2]!];
    const offers = rollMixedOffers(held, createRng(7), 5, 0); // 0 chance → all majors
    const majorIds = offers
      .filter((o) => o.kind === "major")
      .map((o) => (o.kind === "major" ? o.arcana.id : ""));
    for (const h of held) expect(majorIds).not.toContain(h.id);
  });

  it("never offers duplicate Majors within a single roll", () => {
    const offers = rollMixedOffers([], createRng(11), 5, 0); // all majors
    const ids: string[] = [];
    for (const o of offers) {
      if (o.kind === "major") ids.push(o.arcana.id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("with minorChance=1 every slot is a Minor", () => {
    const offers = rollMixedOffers([], createRng(3), 4, 1);
    for (const o of offers) expect(o.kind).toBe("minor");
  });

  it("priceOf returns ARCANA_PRICE for majors, MINOR_PRICE for minors", () => {
    const offers = rollMixedOffers([], createRng(99), 5, 1); // all minors
    for (const o of offers) expect(priceOf(o)).toBe(MINOR_PRICE);
    const m: typeof offers[number] = {
      kind: "major",
      arcana: MAJOR_ARCANA[0]!,
    };
    expect(priceOf(m)).toBe(ARCANA_PRICE);
  });
});
