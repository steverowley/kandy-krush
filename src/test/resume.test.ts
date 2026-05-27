import { describe, expect, it, beforeEach } from "vitest";
import { useResume, spreadKey, querentKey } from "../state/resume";
import type { GameSnapshot } from "../state/game";

function fakeSnap(seed: number): GameSnapshot {
  return {
    mode: "spread",
    levelId: 1,
    seed,
    rngState: seed,
    rows: 7,
    cols: 7,
    tiles: [],
    score: 100,
    moves: 3,
    cleared: { cups: 1, pentacles: 0, swords: 0, wands: 0 },
  };
}

describe("useResume", () => {
  beforeEach(() => {
    useResume.setState({ pending: {} });
  });

  it("stores and retrieves a snapshot by key", () => {
    const snap = fakeSnap(7);
    useResume.getState().saveSnapshot(spreadKey(1), snap);
    expect(useResume.getState().getSnapshot(spreadKey(1))?.seed).toBe(7);
  });

  it("overwrites on subsequent saves", () => {
    useResume.getState().saveSnapshot(spreadKey(1), fakeSnap(7));
    useResume.getState().saveSnapshot(spreadKey(1), fakeSnap(9));
    expect(useResume.getState().getSnapshot(spreadKey(1))?.seed).toBe(9);
  });

  it("clearSnapshot removes one entry", () => {
    useResume.getState().saveSnapshot(spreadKey(1), fakeSnap(7));
    useResume.getState().saveSnapshot(querentKey(3), fakeSnap(11));
    useResume.getState().clearSnapshot(spreadKey(1));
    expect(useResume.getState().getSnapshot(spreadKey(1))).toBeUndefined();
    expect(useResume.getState().getSnapshot(querentKey(3))?.seed).toBe(11);
  });

  it("clearAllForMode wipes every key for that mode", () => {
    useResume.getState().saveSnapshot(spreadKey(1), fakeSnap(1));
    useResume.getState().saveSnapshot(spreadKey(2), fakeSnap(2));
    useResume.getState().saveSnapshot(querentKey(1), fakeSnap(3));
    useResume.getState().saveSnapshot(querentKey(5), fakeSnap(4));
    useResume.getState().clearAllForMode("querent");
    expect(useResume.getState().getSnapshot(spreadKey(1))?.seed).toBe(1);
    expect(useResume.getState().getSnapshot(spreadKey(2))?.seed).toBe(2);
    expect(useResume.getState().getSnapshot(querentKey(1))).toBeUndefined();
    expect(useResume.getState().getSnapshot(querentKey(5))).toBeUndefined();
  });

  it("keys are mode-prefixed so spread:1 and querent:1 don't collide", () => {
    expect(spreadKey(1)).toBe("spread:1");
    expect(querentKey(1)).toBe("querent:1");
    useResume.getState().saveSnapshot(spreadKey(1), fakeSnap(42));
    useResume.getState().saveSnapshot(querentKey(1), fakeSnap(99));
    expect(useResume.getState().getSnapshot(spreadKey(1))?.seed).toBe(42);
    expect(useResume.getState().getSnapshot(querentKey(1))?.seed).toBe(99);
  });
});
