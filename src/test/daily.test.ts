import { describe, expect, it } from "vitest";
import {
  DAILY_ARCANA_COUNT,
  DAILY_MOVE_BUDGET,
  dailyArcana,
  dailySeed,
  todayKey,
} from "../game/daily";
import { createRng } from "../game/engine/rng";
import { newGame } from "../game/engine/engine";
import { MAJOR_ARCANA } from "../game/arcana";

describe("dailySeed", () => {
  it("is deterministic for a given key", () => {
    expect(dailySeed("2026-01-01")).toBe(dailySeed("2026-01-01"));
    expect(dailySeed("2026-05-27")).toBe(dailySeed("2026-05-27"));
  });

  it("differs across days", () => {
    const a = dailySeed("2026-01-01");
    const b = dailySeed("2026-01-02");
    expect(a).not.toBe(b);
  });

  it("fits in a 31-bit positive integer", () => {
    for (const k of ["2024-12-31", "2025-06-15", "2026-05-27", "2030-12-31"]) {
      const s = dailySeed(k);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(2 ** 31);
    }
  });
});

describe("todayKey", () => {
  it("returns YYYY-MM-DD in UTC", () => {
    const k = todayKey(new Date(Date.UTC(2026, 4, 27, 12, 0, 0)));
    expect(k).toBe("2026-05-27");
  });
});

describe("DAILY_MOVE_BUDGET", () => {
  it("is a reasonable mid-game budget", () => {
    expect(DAILY_MOVE_BUDGET).toBeGreaterThan(10);
    expect(DAILY_MOVE_BUDGET).toBeLessThan(50);
  });
});

describe("rng state round-trip", () => {
  it("produces identical sequences when state is captured and restored", () => {
    const a = createRng(12345);
    // Burn 17 draws.
    for (let i = 0; i < 17; i++) a();
    const saved = a.state();

    const next5From = [a(), a(), a(), a(), a()];

    const b = createRng(0); // arbitrary seed
    b.setState(saved);
    const next5Again = [b(), b(), b(), b(), b()];
    expect(next5Again).toEqual(next5From);
  });
});

describe("newGame seed determinism", () => {
  it("produces the same board for the same seed", () => {
    const seed = dailySeed("2026-05-27");
    const { board: b1 } = newGame({ rows: 7, cols: 7, seed });
    const { board: b2 } = newGame({ rows: 7, cols: 7, seed });
    expect(b1.tiles.map((t) => t?.suit)).toEqual(b2.tiles.map((t) => t?.suit));
  });
});

describe("dailyArcana", () => {
  it(`returns ${DAILY_ARCANA_COUNT} arcana ids`, () => {
    expect(dailyArcana("2026-01-01")).toHaveLength(DAILY_ARCANA_COUNT);
  });

  it("is deterministic for a given key", () => {
    expect(dailyArcana("2026-05-28")).toEqual(dailyArcana("2026-05-28"));
  });

  it("differs across days", () => {
    const a = dailyArcana("2026-05-28");
    const b = dailyArcana("2026-05-29");
    expect(a).not.toEqual(b);
  });

  it("only emits real Major Arcana ids", () => {
    const real = new Set(MAJOR_ARCANA.map((a) => a.id));
    for (const key of ["2026-01-01", "2026-06-15", "2026-12-31"]) {
      for (const id of dailyArcana(key)) {
        expect(real.has(id)).toBe(true);
      }
    }
  });

  it("never repeats an arcana within one day's hand", () => {
    for (const key of ["2026-01-01", "2026-06-15", "2026-12-31"]) {
      const hand = dailyArcana(key);
      expect(new Set(hand).size).toBe(hand.length);
    }
  });
});
