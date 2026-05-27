import { describe, expect, it } from "vitest";
import {
  LEVELS,
  levelById,
  objectiveProgress,
  starCount,
  type Level,
} from "../game/levels";
import type { Suit } from "../game/engine/types";

const ZERO_CLEARED: Record<Suit, number> = {
  cups: 0,
  pentacles: 0,
  swords: 0,
  wands: 0,
};

describe("LEVELS data", () => {
  it("has eight chapters", () => {
    expect(LEVELS).toHaveLength(8);
  });

  it("uses sequential ids 1..8", () => {
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("uses ascending star thresholds within each level", () => {
    for (const l of LEVELS) {
      expect(l.stars.one).toBeLessThanOrEqual(l.stars.two);
      expect(l.stars.two).toBeLessThanOrEqual(l.stars.three);
    }
  });

  it("provides reasonable move budgets", () => {
    for (const l of LEVELS) {
      expect(l.moves).toBeGreaterThan(10);
      expect(l.moves).toBeLessThan(100);
    }
  });

  it("suit objectives reference a real suit", () => {
    for (const l of LEVELS) {
      if (l.objective.type === "suit") {
        expect(["cups", "pentacles", "swords", "wands"]).toContain(
          l.objective.suit,
        );
      }
    }
  });
});

describe("levelById", () => {
  it("finds known levels", () => {
    expect(levelById(1)?.name).toBe("The Magician");
    expect(levelById(8)?.name).toBe("Strength");
  });
  it("returns undefined for unknown ids", () => {
    expect(levelById(99)).toBeUndefined();
  });
});

describe("objectiveProgress", () => {
  it("tracks score progress for score levels", () => {
    const lvl: Level = LEVELS[0]!;
    expect(lvl.objective.type).toBe("score");
    const half = objectiveProgress(lvl.objective, 400, ZERO_CLEARED);
    expect(half.value).toBe(400);
    expect(half.target).toBe(lvl.objective.target);
    expect(half.met).toBe(false);

    const done = objectiveProgress(lvl.objective, lvl.objective.target, ZERO_CLEARED);
    expect(done.met).toBe(true);
  });

  it("tracks suit-clear progress for suit levels", () => {
    const lvl = LEVELS.find((l) => l.objective.type === "suit")!;
    if (lvl.objective.type !== "suit") throw new Error("test setup");
    const cleared = { ...ZERO_CLEARED, [lvl.objective.suit]: lvl.objective.target };
    const r = objectiveProgress(lvl.objective, 0, cleared);
    expect(r.value).toBe(lvl.objective.target);
    expect(r.met).toBe(true);
  });

  it("clamps value to target so the bar never overshoots", () => {
    const lvl = LEVELS[0]!;
    if (lvl.objective.type !== "score") throw new Error("test setup");
    const r = objectiveProgress(lvl.objective, lvl.objective.target * 5, ZERO_CLEARED);
    expect(r.value).toBe(lvl.objective.target);
  });
});

describe("starCount", () => {
  const level = LEVELS[0]!;

  it("is zero when the objective is not met", () => {
    expect(starCount(level, 9999, false)).toBe(0);
  });

  it("is one when met but below the silver threshold", () => {
    expect(starCount(level, level.stars.one, true)).toBe(1);
  });

  it("is two when crossing the silver threshold", () => {
    expect(starCount(level, level.stars.two, true)).toBe(2);
  });

  it("is three when crossing the gold threshold", () => {
    expect(starCount(level, level.stars.three, true)).toBe(3);
    expect(starCount(level, level.stars.three * 10, true)).toBe(3);
  });

  it("is at least one when objective met even with low score", () => {
    expect(starCount(level, 0, true)).toBe(1);
  });
});
