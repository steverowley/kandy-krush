import { describe, expect, it } from "vitest";
import {
  CHAMBERS,
  chamberByIndex,
  chamberEffectiveObjective,
} from "../game/querent";
import {
  applyArcanaToStep,
  arcanaById,
  silenceSuitInStep,
} from "../game/arcana";
import type { CascadeStep, MatchGroup, Suit } from "../game/engine/types";

function step(
  matches: Array<{ suit: Suit; cells: number }>,
  overrides: Partial<CascadeStep> = {},
): CascadeStep {
  const groups: MatchGroup[] = matches.map((m) => ({
    suit: m.suit,
    cells: Array.from({ length: m.cells }, (_, i) => ({ row: 0, col: i })),
  }));
  const totalCells = matches.reduce((a, m) => a + m.cells, 0);
  const baseChips = totalCells * 10;
  const baseMult = matches.reduce(
    (a, m) =>
      a +
      (m.cells >= 6 ? 20 : m.cells >= 5 ? 8 : m.cells >= 4 ? 4 : 2),
    0,
  );
  return {
    matches: groups,
    depth: 1,
    chips: baseChips,
    mult: baseMult,
    scoreGained: baseChips * baseMult,
    ...overrides,
  };
}

const META = (over: Partial<Parameters<typeof applyArcanaToStep>[2]> = {}) => ({
  depth: 1,
  movesUsed: 0,
  totalMoves: 12,
  ...over,
});

describe("silenceSuitInStep", () => {
  it("removes silenced suit matches and zeroes their chip/mult share", () => {
    const s = step([
      { suit: "cups", cells: 3 },
      { suit: "wands", cells: 4 },
    ]);
    // base: chips 30+40=70, mult 2+4=6
    const out = silenceSuitInStep(s, "wands");
    // Wand removal: -40 chips, -4 mult
    expect(out.chips).toBe(30);
    expect(out.mult).toBe(2);
    expect(out.matches).toHaveLength(1);
    expect(out.matches[0]!.suit).toBe("cups");
  });

  it("is a no-op when no matches of that suit are present", () => {
    const s = step([{ suit: "cups", cells: 3 }]);
    const out = silenceSuitInStep(s, "wands");
    expect(out.chips).toBe(30);
    expect(out.mult).toBe(2);
    expect(out.matches).toHaveLength(1);
  });

  it("clamps chips and mult at zero when fully silenced", () => {
    const s = step([{ suit: "wands", cells: 3 }]);
    const out = silenceSuitInStep(s, "wands");
    expect(out.chips).toBe(0);
    expect(out.mult).toBe(0);
    expect(out.matches).toHaveLength(0);
  });
});

describe("applyArcanaToStep with halveArcana", () => {
  it("halves the arcana delta but leaves engine base intact", () => {
    const magician = arcanaById("magician")!;
    const s = step([{ suit: "wands", cells: 4 }]);
    // base: chips 40, mult 4
    // magician: +4 wand cells × 30 = +120 chips → 160 total
    // halved delta: base + (delta * 0.5) = 40 + 60 = 100
    const halved = applyArcanaToStep(s, [magician], META({ halveArcana: true }));
    expect(halved.chips).toBe(100);
    expect(halved.mult).toBe(4); // magician doesn't touch mult
  });

  it("halves a mult delta as well", () => {
    const strength = arcanaById("strength")!;
    const s = step([{ suit: "wands", cells: 4 }]);
    // base mult 4; strength adds +2 for the ≥4 match → 6
    // halved: 4 + round(2 * 0.5) = 4 + 1 = 5
    const halved = applyArcanaToStep(s, [strength], META({ halveArcana: true }));
    expect(halved.mult).toBe(5);
  });

  it("no-ops when there are no held arcana", () => {
    const s = step([{ suit: "cups", cells: 3 }]);
    const halved = applyArcanaToStep(s, [], META({ halveArcana: true }));
    expect(halved.chips).toBe(30);
    expect(halved.mult).toBe(2);
  });
});

describe("CHAMBERS — boss restrictions", () => {
  it("Chamber 4 (Hanged Man) silences Wands", () => {
    const ch = chamberByIndex(4)!;
    expect(ch.boss).toBe(true);
    expect(ch.restriction?.silenceSuit).toBe("wands");
  });

  it("Chamber 7 (Devil) halves Arcana", () => {
    const ch = chamberByIndex(7)!;
    expect(ch.boss).toBe(true);
    expect(ch.restriction?.halveArcana).toBe(true);
  });

  it("Chamber 9 (Star) raises target by 1.5×", () => {
    const ch = chamberByIndex(9)!;
    expect(ch.boss).toBe(true);
    expect(ch.restriction?.targetMultiplier).toBe(1.5);
  });

  it("Chamber 12 (Judgement) silences Pentacles", () => {
    const ch = chamberByIndex(12)!;
    expect(ch.boss).toBe(true);
    expect(ch.restriction?.silenceSuit).toBe("pentacles");
  });

  it("Chamber 13 (World) doubles the target", () => {
    const ch = chamberByIndex(13)!;
    expect(ch.boss).toBe(true);
    expect(ch.restriction?.targetMultiplier).toBe(2);
  });

  it("every boss chamber declares a restriction; every non-boss does not", () => {
    for (const ch of CHAMBERS) {
      if (ch.boss) expect(ch.restriction).toBeDefined();
      else expect(ch.restriction).toBeUndefined();
    }
  });

  it("every restriction has a human-readable name + description + flavor", () => {
    for (const ch of CHAMBERS) {
      if (!ch.restriction) continue;
      expect(ch.restriction.name.length).toBeGreaterThan(0);
      expect(ch.restriction.description.length).toBeGreaterThan(0);
      expect(ch.restriction.flavor.length).toBeGreaterThan(0);
    }
  });
});

describe("chamberEffectiveObjective", () => {
  it("scales the score target by restriction.targetMultiplier", () => {
    const ch = chamberByIndex(13)!; // The World, 2× multiplier
    const o = chamberEffectiveObjective(ch);
    expect(o.type).toBe("score");
    if (o.type !== "score") throw new Error("test setup");
    if (ch.objective.type !== "score") throw new Error("test setup");
    expect(o.target).toBe(ch.objective.target * 2);
  });

  it("returns the objective unchanged when no multiplier is set", () => {
    const ch = chamberByIndex(1)!;
    expect(chamberEffectiveObjective(ch)).toEqual(ch.objective);
  });

  it("leaves suit-type objectives alone even on bosses (per design)", () => {
    const ch = chamberByIndex(12)!; // Judgement, silences a suit but target unaffected
    expect(chamberEffectiveObjective(ch)).toEqual(ch.objective);
  });
});

describe("integration — silencing a Wand-heavy step zeros the score", () => {
  it("a pure wand match scores zero under Wands-silent", () => {
    const s = step([{ suit: "wands", cells: 4 }]);
    const silenced = silenceSuitInStep(s, "wands");
    const out = applyArcanaToStep(silenced, [], META());
    expect(out.scoreGained).toBe(0);
  });

  it("a mixed step still scores the non-wand portion", () => {
    const s = step([
      { suit: "cups", cells: 3 },
      { suit: "wands", cells: 3 },
    ]);
    const silenced = silenceSuitInStep(s, "wands");
    const out = applyArcanaToStep(silenced, [], META());
    // After silence: chips 30, mult 2 → score 60
    expect(out.scoreGained).toBe(60);
  });
});

describe("Boss chamber restriction shapes", () => {
  it("Death chamber (5) is a boss with destroyEveryN=5", () => {
    const ch = chamberByIndex(5)!;
    expect(ch.boss).toBe(true);
    expect(ch.restriction?.destroyEveryN).toBe(5);
  });

  it("Star chamber (9) keeps its target ×1.5 and adds blockSpecialPromotions", () => {
    const ch = chamberByIndex(9)!;
    expect(ch.boss).toBe(true);
    expect(ch.restriction?.targetMultiplier).toBe(1.5);
    expect(ch.restriction?.blockSpecialPromotions).toBe(true);
  });

  it("Moon chamber (10) is a boss with obscureUntilAdjacentTo='wild'", () => {
    const ch = chamberByIndex(10)!;
    expect(ch.boss).toBe(true);
    expect(ch.restriction?.obscureUntilAdjacentTo).toBe("wild");
  });

  it("boss count is at least 7 after Death + Moon promotion", () => {
    const bossCount = CHAMBERS.filter((c) => c.boss).length;
    expect(bossCount).toBeGreaterThanOrEqual(7);
  });
});
