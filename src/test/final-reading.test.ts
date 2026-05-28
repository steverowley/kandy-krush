import { describe, expect, it, beforeEach } from "vitest";
import {
  BOSS_PACE_RATIO,
  DAILY_FORTUNE_THRESHOLD,
  FINAL_CHAMBERS,
  FINAL_CHAMBER_COUNT,
  finalChamberByIndex,
} from "../game/final-reading";
import { useQuerent } from "../state/querent";

describe("FINAL_CHAMBERS data", () => {
  it("has three escalating chambers indexed 1..3", () => {
    expect(FINAL_CHAMBER_COUNT).toBe(3);
    expect(FINAL_CHAMBERS.map((c) => c.index)).toEqual([1, 2, 3]);
  });

  it("score targets escalate across the three chambers", () => {
    for (let i = 1; i < FINAL_CHAMBERS.length; i++) {
      expect(FINAL_CHAMBERS[i]!.target).toBeGreaterThan(
        FINAL_CHAMBERS[i - 1]!.target,
      );
    }
  });

  it("each chamber declares a restriction", () => {
    for (const c of FINAL_CHAMBERS) {
      expect(c.restriction).toBeDefined();
      expect(c.restriction.id.length).toBeGreaterThan(0);
    }
  });

  it("chamber 3 is The World", () => {
    expect(FINAL_CHAMBERS[2]!.name).toBe("The World");
  });

  it("finalChamberByIndex maps 1..3", () => {
    expect(finalChamberByIndex(1)?.name).toBe("The Shadow");
    expect(finalChamberByIndex(2)?.name).toBe("The Dealer");
    expect(finalChamberByIndex(3)?.name).toBe("The World");
  });

  it("finalChamberByIndex returns undefined out of range", () => {
    expect(finalChamberByIndex(0)).toBeUndefined();
    expect(finalChamberByIndex(4)).toBeUndefined();
  });
});

describe("Key thresholds", () => {
  it("BOSS_PACE_RATIO is a meaningful 3-star bar", () => {
    expect(BOSS_PACE_RATIO).toBeGreaterThan(1);
    expect(BOSS_PACE_RATIO).toBeLessThanOrEqual(2);
  });

  it("DAILY_FORTUNE_THRESHOLD is positive", () => {
    expect(DAILY_FORTUNE_THRESHOLD).toBeGreaterThan(0);
  });
});

describe("useQuerent — keys + Final Reading lifecycle", () => {
  beforeEach(() => {
    useQuerent.setState({
      run: null,
      meta: {
        runsCompleted: 0,
        bestDepth: 0,
        insight: 0,
        unlocked: ["seer"],
        maxStakeId: "white",
        currentStakeId: "white",
        records: {},
      },
    });
  });

  it("starts with no keys held and isFinalUnlocked = false", () => {
    expect(useQuerent.getState().meta.keys ?? {}).toEqual({});
    expect(useQuerent.getState().isFinalUnlocked()).toBe(false);
  });

  it("grantKey is idempotent — re-granting is a no-op", () => {
    useQuerent.getState().grantKey("boss");
    useQuerent.getState().grantKey("boss");
    expect(useQuerent.getState().meta.keys?.boss).toBe(true);
    // Only one key kind is set.
    const keys = useQuerent.getState().meta.keys ?? {};
    expect(Object.keys(keys).filter((k) => keys[k as never])).toEqual(["boss"]);
  });

  it("isFinalUnlocked requires all 3 keys AND a completed run", () => {
    useQuerent.getState().grantKey("boss");
    useQuerent.getState().grantKey("daily");
    useQuerent.getState().grantKey("spread");
    expect(useQuerent.getState().isFinalUnlocked()).toBe(false);
    useQuerent.setState({
      meta: { ...useQuerent.getState().meta, runsCompleted: 1 },
    });
    expect(useQuerent.getState().isFinalUnlocked()).toBe(true);
  });

  it("beginFinalReading sets finalRun at chamber 1", () => {
    useQuerent.getState().beginFinalReading();
    expect(useQuerent.getState().meta.finalRun).toEqual({ chamberIndex: 1 });
  });

  it("passFinalChamber advances to chamber 2 then 3", () => {
    useQuerent.getState().beginFinalReading();
    useQuerent.getState().passFinalChamber();
    expect(useQuerent.getState().meta.finalRun?.chamberIndex).toBe(2);
    useQuerent.getState().passFinalChamber();
    expect(useQuerent.getState().meta.finalRun?.chamberIndex).toBe(3);
  });

  it("passFinalChamber past the last is a no-op (caller finishes)", () => {
    useQuerent.setState({
      meta: { ...useQuerent.getState().meta, finalRun: { chamberIndex: 3 } },
    });
    useQuerent.getState().passFinalChamber();
    expect(useQuerent.getState().meta.finalRun?.chamberIndex).toBe(3);
  });

  it("finishFinalReading flips seenTheWorld and clears finalRun", () => {
    useQuerent.setState({
      meta: { ...useQuerent.getState().meta, finalRun: { chamberIndex: 3 } },
    });
    useQuerent.getState().finishFinalReading();
    expect(useQuerent.getState().meta.seenTheWorld).toBe(true);
    expect(useQuerent.getState().meta.finalRun).toBeUndefined();
  });

  it("failFinalReading clears finalRun without flipping seenTheWorld", () => {
    useQuerent.setState({
      meta: { ...useQuerent.getState().meta, finalRun: { chamberIndex: 2 } },
    });
    useQuerent.getState().failFinalReading();
    expect(useQuerent.getState().meta.finalRun).toBeUndefined();
    expect(useQuerent.getState().meta.seenTheWorld).toBeUndefined();
  });
});
