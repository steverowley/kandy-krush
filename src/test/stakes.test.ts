import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_STAKE,
  STAKES,
  STAKE_COUNT,
  nextStakeAfter,
  stakeById,
  stakeByTier,
} from "../game/stakes";
import {
  chamberByIndex,
  chamberEffectiveObjective,
  chamberMovesFor,
} from "../game/querent";
import { useQuerent } from "../state/querent";

describe("STAKES data", () => {
  it("has eight tiers", () => {
    expect(STAKE_COUNT).toBe(8);
  });

  it("tier indices are 0..7 in declaration order", () => {
    STAKES.forEach((s, i) => expect(s.tier).toBe(i));
  });

  it("ids are unique", () => {
    const ids = STAKES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("difficulty increases monotonically (multiplier up, moves down)", () => {
    for (let i = 1; i < STAKES.length; i++) {
      const a = STAKES[i - 1]!;
      const b = STAKES[i]!;
      expect(b.targetMultiplier).toBeGreaterThanOrEqual(a.targetMultiplier);
      expect(b.moveDelta).toBeLessThanOrEqual(a.moveDelta);
    }
  });

  it("White is the baseline (×1, no move delta)", () => {
    const white = stakeById("white")!;
    expect(white.targetMultiplier).toBe(1);
    expect(white.moveDelta).toBe(0);
  });

  it("Gold is the hardest tier (largest multiplier, most negative moves)", () => {
    const gold = stakeById("gold")!;
    const others = STAKES.filter((s) => s.id !== "gold");
    for (const s of others) {
      expect(gold.targetMultiplier).toBeGreaterThan(s.targetMultiplier);
      expect(gold.moveDelta).toBeLessThanOrEqual(s.moveDelta);
    }
  });
});

describe("stakeById / stakeByTier / nextStakeAfter", () => {
  it("stakeById returns the matching stake", () => {
    expect(stakeById("red")?.name).toBe("Red");
  });
  it("stakeById returns undefined for unknown ids", () => {
    expect(stakeById("nope" as never)).toBeUndefined();
  });
  it("stakeByTier maps 0..7 to the right entries", () => {
    expect(stakeByTier(0)?.id).toBe("white");
    expect(stakeByTier(7)?.id).toBe("gold");
  });
  it("nextStakeAfter steps White → Red → Green → ...", () => {
    expect(nextStakeAfter("white")?.id).toBe("red");
    expect(nextStakeAfter("red")?.id).toBe("green");
  });
  it("nextStakeAfter('gold') is null (max tier)", () => {
    expect(nextStakeAfter("gold")).toBeNull();
  });
});

describe("chamber helpers respect stake", () => {
  const ch = chamberByIndex(1)!; // Hermit, score target 1500, 12 base moves

  it("chamberMovesFor applies stake.moveDelta on top of class.moveBonus", () => {
    const seer = { id: "seer" as const, moveBonus: 2 } as never;
    const white = stakeById("white")!;
    const red = stakeById("red")!;
    expect(chamberMovesFor(ch, seer, white)).toBe(12 + 2 + 0); // 14
    expect(chamberMovesFor(ch, seer, red)).toBe(12 + 2 - 1); // 13
  });

  it("chamberMovesFor clamps to at least 1 move", () => {
    const klass = { id: "seer" as const, moveBonus: 0 } as never;
    const huge = { ...stakeById("gold")!, moveDelta: -100 };
    expect(chamberMovesFor(ch, klass, huge)).toBe(1);
  });

  it("chamberEffectiveObjective stacks stake mul on top of boss mul", () => {
    const world = chamberByIndex(13)!; // 2× boss multiplier
    const red = stakeById("red")!; // 1.1× stake multiplier
    const o = chamberEffectiveObjective(world, red);
    if (o.type !== "score") throw new Error("test setup");
    if (world.objective.type !== "score") throw new Error("test setup");
    expect(o.target).toBe(Math.round(world.objective.target * 2 * 1.1));
  });

  it("chamberEffectiveObjective leaves suit objectives alone even with stake", () => {
    const judgement = chamberByIndex(12)!; // suit objective
    const gold = stakeById("gold")!;
    expect(chamberEffectiveObjective(judgement, gold)).toEqual(judgement.objective);
  });

  it("chamberEffectiveObjective returns the bare objective at White stake on non-boss", () => {
    const white = stakeById("white")!;
    expect(chamberEffectiveObjective(ch, white)).toEqual(ch.objective);
  });
});

describe("useQuerent stake state", () => {
  beforeEach(() => {
    useQuerent.setState({
      run: null,
      meta: {
        runsCompleted: 0,
        bestDepth: 0,
        insight: 0,
        unlocked: ["seer"],
        maxStakeId: DEFAULT_STAKE,
        currentStakeId: DEFAULT_STAKE,
      },
    });
  });

  it("starts at the White stake with only White unlocked", () => {
    const meta = useQuerent.getState().meta;
    expect(meta.maxStakeId).toBe("white");
    expect(meta.currentStakeId).toBe("white");
  });

  it("setStake accepts an unlocked stake", () => {
    useQuerent.setState({
      run: null,
      meta: {
        ...useQuerent.getState().meta,
        maxStakeId: "green",
        currentStakeId: "white",
      },
    });
    useQuerent.getState().setStake("red");
    expect(useQuerent.getState().meta.currentStakeId).toBe("red");
  });

  it("setStake rejects a stake the player hasn't unlocked", () => {
    useQuerent.getState().setStake("red"); // max is white
    expect(useQuerent.getState().meta.currentStakeId).toBe("white");
  });

  it("beginRun stamps the current stake onto the run", () => {
    useQuerent.setState({
      run: null,
      meta: {
        ...useQuerent.getState().meta,
        maxStakeId: "red",
        currentStakeId: "red",
      },
    });
    useQuerent.getState().beginRun("seer");
    expect(useQuerent.getState().run!.stakeId).toBe("red");
  });

  it("finishRun on the max stake unlocks the next tier", () => {
    useQuerent.setState({
      run: {
        classId: "seer",
        chamberIndex: 14,
        totalScore: 100000,
        cleared: 13,
        startedAt: Date.now(),
        stakeId: "white",
      },
      meta: {
        ...useQuerent.getState().meta,
        maxStakeId: "white",
        currentStakeId: "white",
      },
    });
    useQuerent.getState().finishRun();
    expect(useQuerent.getState().meta.maxStakeId).toBe("red");
    expect(useQuerent.getState().meta.currentStakeId).toBe("red");
  });

  it("finishRun on a sub-max stake doesn't unlock further", () => {
    useQuerent.setState({
      run: {
        classId: "seer",
        chamberIndex: 14,
        totalScore: 100000,
        cleared: 13,
        startedAt: Date.now(),
        stakeId: "white",
      },
      meta: {
        ...useQuerent.getState().meta,
        maxStakeId: "green",
        currentStakeId: "white",
      },
    });
    useQuerent.getState().finishRun();
    expect(useQuerent.getState().meta.maxStakeId).toBe("green");
  });

  it("finishRun at Gold doesn't crash trying to unlock the next tier", () => {
    useQuerent.setState({
      run: {
        classId: "seer",
        chamberIndex: 14,
        totalScore: 100000,
        cleared: 13,
        startedAt: Date.now(),
        stakeId: "gold",
      },
      meta: {
        ...useQuerent.getState().meta,
        maxStakeId: "gold",
        currentStakeId: "gold",
      },
    });
    expect(() => useQuerent.getState().finishRun()).not.toThrow();
    expect(useQuerent.getState().meta.maxStakeId).toBe("gold");
  });
});
