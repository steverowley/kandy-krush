import { describe, expect, it, beforeEach } from "vitest";
import {
  CHAMBERS,
  CHAMBER_COUNT,
  CLASSES,
  chamberByIndex,
  chamberEffectiveObjective,
  chamberMovesFor,
  classById,
} from "../game/querent";
import { useQuerent } from "../state/querent";
import { useMinorArcana } from "../state/minor-arcana";

describe("CLASSES", () => {
  it("declares six classes — three founding, three unlock paths", () => {
    expect(CLASSES.map((c) => c.id)).toEqual([
      "seer",
      "maker",
      "walker",
      "skeptic",
      "mystic",
      "gambler",
    ]);
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
  it("has thirteen chambers indexed 1..13", () => {
    expect(CHAMBER_COUNT).toBe(13);
    expect(CHAMBERS.map((c) => c.index)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
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
        maxStakeId: "white",
        currentStakeId: "white",
        records: {},
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

describe("per-stake records", () => {
  beforeEach(() => {
    useQuerent.setState({
      run: null,
      meta: {
        runsCompleted: 0,
        bestDepth: 0,
        insight: 0,
        unlocked: ["seer", "maker", "walker"],
        maxStakeId: "green",
        currentStakeId: "red",
        records: {},
      },
    });
  });

  it("passChamber updates the active stake's bestDepth", () => {
    useQuerent.getState().beginRun("seer");
    useQuerent.getState().passChamber(100);
    useQuerent.getState().passChamber(100);
    const rec = useQuerent.getState().meta.records.red;
    expect(rec).toBeDefined();
    expect(rec!.bestDepth).toBe(2);
  });

  it("failRun records the run's totalScore as bestScore for that stake", () => {
    useQuerent.getState().beginRun("seer");
    useQuerent.getState().passChamber(500);
    useQuerent.getState().passChamber(700);
    useQuerent.getState().failRun();
    const rec = useQuerent.getState().meta.records.red;
    expect(rec!.bestScore).toBe(1200);
    expect(rec!.cleared).toBe(false);
  });

  it("finishRun flips cleared + bumps runsCompleted for that stake", () => {
    useQuerent.getState().beginRun("seer");
    for (let i = 0; i < 9; i++) useQuerent.getState().passChamber(100);
    useQuerent.getState().finishRun();
    const rec = useQuerent.getState().meta.records.red;
    expect(rec!.cleared).toBe(true);
    expect(rec!.runsCompleted).toBe(1);
    expect(rec!.bestScore).toBe(900);
  });

  it("bestScore is the max across runs at the same stake", () => {
    useQuerent.getState().beginRun("seer");
    useQuerent.getState().passChamber(1000);
    useQuerent.getState().failRun();
    useQuerent.getState().beginRun("seer");
    useQuerent.getState().passChamber(400); // worse run
    useQuerent.getState().failRun();
    const rec = useQuerent.getState().meta.records.red;
    expect(rec!.bestScore).toBe(1000);
  });

  it("records are independent per stake", () => {
    useQuerent.getState().beginRun("seer");
    useQuerent.getState().passChamber(800);
    useQuerent.getState().failRun();
    // Switch stakes, run again.
    useQuerent.setState({
      meta: { ...useQuerent.getState().meta, currentStakeId: "green" },
    });
    useQuerent.getState().beginRun("seer");
    useQuerent.getState().passChamber(200);
    useQuerent.getState().failRun();
    const records = useQuerent.getState().meta.records;
    expect(records.red!.bestScore).toBe(800);
    expect(records.green!.bestScore).toBe(200);
  });
});

describe("new class identities", () => {
  it("Skeptic shrinks the Major hand to 4 and adds an extra Minor draw", () => {
    const k = CLASSES.find((c) => c.id === "skeptic")!;
    expect(k.handCap).toBe(4);
    expect(k.extraMinorDraw).toBe(true);
  });

  it("Mystic enables suit-level growth across the run", () => {
    const k = CLASSES.find((c) => c.id === "mystic")!;
    expect(k.suitLevelGrowth).toBe(true);
  });

  it("Gambler gets +1 reroll, +1 starting Minor, and +15% score targets", () => {
    const k = CLASSES.find((c) => c.id === "gambler")!;
    expect(k.parlourRerollBonus).toBe(1);
    expect(k.startMinorGrant).toBe(1);
    expect(k.targetMultiplier).toBeCloseTo(1.15);
  });

  it("chamberEffectiveObjective stacks the class targetMultiplier", () => {
    const gambler = CLASSES.find((c) => c.id === "gambler")!;
    const ch = chamberByIndex(13)!; // World ×2 boss
    const o = chamberEffectiveObjective(ch, null, gambler);
    if (o.type !== "score" || ch.objective.type !== "score") {
      throw new Error("test setup");
    }
    // 2× boss × 1.15 class
    expect(o.target).toBe(Math.round(ch.objective.target * 2 * 1.15));
  });
});

describe("class unlock progression on finishRun", () => {
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

  function finishOne() {
    useQuerent.getState().beginRun("seer");
    for (let i = 0; i < 9; i++) useQuerent.getState().passChamber(100);
    useQuerent.getState().finishRun();
  }

  it("1st finish unlocks Maker + Walker only", () => {
    finishOne();
    const unlocked = useQuerent.getState().meta.unlocked;
    expect(unlocked).toContain("maker");
    expect(unlocked).toContain("walker");
    expect(unlocked).not.toContain("skeptic");
  });

  it("2nd finish adds Skeptic", () => {
    finishOne();
    finishOne();
    expect(useQuerent.getState().meta.unlocked).toContain("skeptic");
  });

  it("3rd finish adds Mystic", () => {
    finishOne();
    finishOne();
    finishOne();
    expect(useQuerent.getState().meta.unlocked).toContain("mystic");
  });

  it("4th finish adds Gambler", () => {
    finishOne();
    finishOne();
    finishOne();
    finishOne();
    expect(useQuerent.getState().meta.unlocked).toContain("gambler");
  });

  it("Gambler beginRun grants 1 random Minor at run start", () => {
    useQuerent.setState({
      meta: { ...useQuerent.getState().meta, unlocked: ["seer", "gambler"] },
    });
    useMinorArcana.getState().reset();
    useQuerent.getState().beginRun("gambler");
    expect(useMinorArcana.getState().heldIds).toHaveLength(1);
  });

  it("Skeptic beginRun does NOT grant a starting Minor", () => {
    useQuerent.setState({
      meta: { ...useQuerent.getState().meta, unlocked: ["seer", "skeptic"] },
    });
    useMinorArcana.getState().reset();
    useQuerent.getState().beginRun("skeptic");
    expect(useMinorArcana.getState().heldIds).toHaveLength(0);
  });
});
