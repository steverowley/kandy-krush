import { describe, expect, it, beforeEach } from "vitest";
import {
  CHAMBERS,
  CHAMBER_COUNT,
  CLASSES,
  chamberByIndex,
  chamberMovesFor,
  classById,
} from "../game/querent";
import { useQuerent } from "../state/querent";

describe("CLASSES", () => {
  it("has the three founding classes", () => {
    expect(CLASSES.map((c) => c.id)).toEqual(["seer", "maker", "walker"]);
  });

  it("score multipliers are sane", () => {
    for (const c of CLASSES) {
      expect(c.scoreMultiplier).toBeGreaterThanOrEqual(1);
      expect(c.scoreMultiplier).toBeLessThanOrEqual(1.5);
    }
  });

  it("move bonuses are small + non-negative", () => {
    for (const c of CLASSES) {
      expect(c.moveBonus).toBeGreaterThanOrEqual(0);
      expect(c.moveBonus).toBeLessThanOrEqual(3);
    }
  });

  it("each class declares a panel color", () => {
    for (const c of CLASSES) expect(c.panelColor).toMatch(/^var\(--panel-/);
  });
});

describe("CHAMBERS", () => {
  it("has nine chambers indexed 1..9", () => {
    expect(CHAMBER_COUNT).toBe(9);
    expect(CHAMBERS.map((c) => c.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("marks boss chambers", () => {
    const bosses = CHAMBERS.filter((c) => c.boss);
    expect(bosses.length).toBeGreaterThanOrEqual(2);
  });

  it("budgets are between 10 and 30 readings", () => {
    for (const c of CHAMBERS) {
      expect(c.baseMoves).toBeGreaterThan(9);
      expect(c.baseMoves).toBeLessThanOrEqual(30);
    }
  });

  it("every chamber has a panel color", () => {
    for (const c of CHAMBERS) expect(c.panelColor).toMatch(/^var\(--panel-/);
  });
});

describe("chamberMovesFor", () => {
  it("adds class move bonus to base moves", () => {
    const c = chamberByIndex(1)!;
    const seer = classById("seer")!;
    expect(chamberMovesFor(c, seer)).toBe(c.baseMoves + seer.moveBonus);
  });
});

describe("useQuerent meta progression", () => {
  beforeEach(() => {
    useQuerent.setState({
      run: null,
      meta: {
        runsCompleted: 0,
        bestDepth: 0,
        insight: 0,
        unlocked: ["seer"],
      },
    });
  });

  it("starts with only the Seer unlocked", () => {
    const { isUnlocked } = useQuerent.getState();
    expect(isUnlocked("seer")).toBe(true);
    expect(isUnlocked("maker")).toBe(false);
    expect(isUnlocked("walker")).toBe(false);
  });

  it("beginRun establishes a fresh run", () => {
    useQuerent.getState().beginRun("seer");
    const r = useQuerent.getState().run!;
    expect(r.classId).toBe("seer");
    expect(r.chamberIndex).toBe(1);
    expect(r.totalScore).toBe(0);
    expect(r.cleared).toBe(0);
  });

  it("passChamber advances + tallies fortune + updates bestDepth", () => {
    useQuerent.getState().beginRun("seer");
    useQuerent.getState().passChamber(420);
    const r = useQuerent.getState().run!;
    const meta = useQuerent.getState().meta;
    expect(r.chamberIndex).toBe(2);
    expect(r.totalScore).toBe(420);
    expect(r.cleared).toBe(1);
    expect(meta.bestDepth).toBe(1);
  });

  it("failRun ends the run and unlocks Maker", () => {
    useQuerent.getState().beginRun("seer");
    useQuerent.getState().passChamber(800);
    useQuerent.getState().failRun();
    const s = useQuerent.getState();
    expect(s.run).toBeNull();
    expect(s.meta.unlocked).toContain("maker");
    expect(s.meta.insight).toBe(800);
  });

  it("finishRun bumps runsCompleted + unlocks Walker", () => {
    useQuerent.getState().beginRun("seer");
    for (let i = 0; i < 9; i++) useQuerent.getState().passChamber(100);
    useQuerent.getState().finishRun();
    const s = useQuerent.getState();
    expect(s.run).toBeNull();
    expect(s.meta.runsCompleted).toBe(1);
    expect(s.meta.unlocked).toContain("walker");
    expect(s.meta.unlocked).toContain("maker");
    expect(s.meta.bestDepth).toBeGreaterThanOrEqual(9);
  });

  it("abandonRun drops the run without bumping meta", () => {
    useQuerent.getState().beginRun("seer");
    useQuerent.getState().passChamber(500);
    const before = useQuerent.getState().meta.insight;
    useQuerent.getState().abandonRun();
    expect(useQuerent.getState().run).toBeNull();
    expect(useQuerent.getState().meta.insight).toBe(before);
  });
});
