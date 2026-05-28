import { describe, expect, it } from "vitest";
import {
  LEVELS,
  levelById,
  objectiveProgress,
  starCount,
  type Level,
} from "../game/levels";
import { MAJOR_ARCANA } from "../game/arcana";
import type { Suit } from "../game/engine/types";

const ZERO_CLEARED: Record<Suit, number> = {
  cups: 0,
  pentacles: 0,
  swords: 0,
  wands: 0,
};

describe("LEVELS data", () => {
  it("has twelve chapters", () => {
    expect(LEVELS).toHaveLength(12);
  });

  it("uses sequential ids 1..12", () => {
    expect(LEVELS.map((l) => l.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
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
    expect(levelById(12)?.name).toBe("The Hanged Man");
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

describe("Spread chapter arcana hands", () => {
  it("at least four chapters carry a pre-loaded arcana hand", () => {
    const withArcana = LEVELS.filter((l) => l.arcana && l.arcana.length > 0);
    expect(withArcana.length).toBeGreaterThanOrEqual(4);
  });

  it("each declared arcana id is a real Major", () => {
    const real = new Set(MAJOR_ARCANA.map((a) => a.id));
    for (const lvl of LEVELS) {
      for (const id of lvl.arcana ?? []) {
        expect(real.has(id)).toBe(true);
      }
    }
  });

  it("thematic match on at least the title-named chapters", () => {
    const magician = LEVELS.find((l) => l.id === 1)!;
    expect(magician.arcana).toContain("magician");
    const empress = LEVELS.find((l) => l.id === 3)!;
    expect(empress.arcana).toContain("empress");
    const strength = LEVELS.find((l) => l.id === 8)!;
    expect(strength.arcana).toContain("strength");
    const hangedMan = LEVELS.find((l) => l.id === 12)!;
    expect(hangedMan.arcana).toContain("hanged-man");
  });

  it("late chapters can stack multiple arcana", () => {
    const hangedMan = LEVELS.find((l) => l.id === 12)!;
    expect((hangedMan.arcana ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
