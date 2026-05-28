import { describe, expect, it, beforeEach } from "vitest";
import {
  MAX_HELD_MINORS,
  MINOR_ARCANA,
  minorById,
} from "../game/minor-arcana";
import { useMinorArcana } from "../state/minor-arcana";
import { useGame } from "../state/game";
import { useArcana } from "../state/arcana";
import { createRng } from "../game/engine/rng";
import { findMatches } from "../game/engine/match";

describe("MINOR_ARCANA data", () => {
  it("has at least three starter consumables", () => {
    expect(MINOR_ARCANA.length).toBeGreaterThanOrEqual(3);
  });

  it("every entry declares a unique id", () => {
    const ids = MINOR_ARCANA.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry declares a panel color token", () => {
    for (const m of MINOR_ARCANA) {
      expect(m.panelColor).toMatch(/^var\(--panel-/);
    }
  });

  it("every entry has a non-empty description + flavor", () => {
    for (const m of MINOR_ARCANA) {
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.flavor.length).toBeGreaterThan(0);
    }
  });

  it("Page of Pentacles adds +3 readings", () => {
    const m = minorById("page-pentacles")!;
    expect(m.effect).toEqual({ kind: "add-moves", amount: 3 });
  });

  it("Page of Cups adds +1500 fortune", () => {
    const m = minorById("page-cups")!;
    expect(m.effect).toEqual({ kind: "add-score", amount: 1500 });
  });

  it("Page of Wands arms a 2x next-move score", () => {
    const m = minorById("page-wands")!;
    expect(m.effect).toEqual({ kind: "next-move-score-mul", multiplier: 2 });
  });

  it("Knight of Cups adds +2 readings", () => {
    expect(minorById("knight-cups")!.effect).toEqual({
      kind: "add-moves",
      amount: 2,
    });
  });

  it("Knight of Pentacles adds +3000 fortune", () => {
    expect(minorById("knight-pentacles")!.effect).toEqual({
      kind: "add-score",
      amount: 3000,
    });
  });

  it("Knight of Wands arms a 3x next-move score", () => {
    expect(minorById("knight-wands")!.effect).toEqual({
      kind: "next-move-score-mul",
      multiplier: 3,
    });
  });

  it("Queen of Wands arms a 3x next-move mult", () => {
    expect(minorById("queen-wands")!.effect).toEqual({
      kind: "next-move-mult-mul",
      multiplier: 3,
    });
  });

  it("King of Pentacles adds +5 chips per cell next move", () => {
    expect(minorById("king-pentacles")!.effect).toEqual({
      kind: "next-move-chips-per-cell",
      perCell: 5,
    });
  });

  it("Queen of Cups converts swords to cups", () => {
    expect(minorById("queen-cups")!.effect).toEqual({
      kind: "convert-suit",
      from: "swords",
      to: "cups",
    });
  });

  it("Queen of Pentacles pays out 20 fortune per Pentacle", () => {
    expect(minorById("queen-pentacles")!.effect).toEqual({
      kind: "pentacle-payout",
      perPentacle: 20,
    });
  });

  it("Queen of Swords destroys a random row", () => {
    expect(minorById("queen-swords")!.effect).toEqual({
      kind: "destroy-random-row",
    });
  });

  it("King of Cups reshuffles the board", () => {
    expect(minorById("king-cups")!.effect).toEqual({
      kind: "reshuffle-board",
    });
  });

  it("King of Swords destroys a random column", () => {
    expect(minorById("king-swords")!.effect).toEqual({
      kind: "destroy-random-col",
    });
  });
});

describe("minorById", () => {
  it("returns the matching minor", () => {
    expect(minorById("page-cups")?.name).toBe("Page of Cups");
  });
  it("returns undefined for an unknown id", () => {
    expect(minorById("unknown" as never)).toBeUndefined();
  });
});

describe("useMinorArcana store", () => {
  beforeEach(() => {
    useMinorArcana.getState().reset();
  });

  it("starts empty", () => {
    expect(useMinorArcana.getState().heldIds).toEqual([]);
  });

  it("grant adds the minor to the hand", () => {
    useMinorArcana.getState().grant("page-cups");
    expect(useMinorArcana.getState().heldIds).toEqual(["page-cups"]);
  });

  it("grant is a no-op when full", () => {
    const ids = MINOR_ARCANA.slice(0, MAX_HELD_MINORS).map((m) => m.id);
    useMinorArcana.setState({ heldIds: ids });
    useMinorArcana.getState().grant("page-cups");
    expect(useMinorArcana.getState().heldIds).toEqual(ids);
  });

  it("grantRandom returns the granted minor when there is room", () => {
    const rng = createRng(7);
    const granted = useMinorArcana.getState().grantRandom(rng);
    expect(granted).not.toBeNull();
    expect(useMinorArcana.getState().heldIds).toContain(granted!.id);
  });

  it("grantRandom returns null when the hand is full", () => {
    const ids = MINOR_ARCANA.slice(0, MAX_HELD_MINORS).map((m) => m.id);
    useMinorArcana.setState({ heldIds: ids });
    const granted = useMinorArcana.getState().grantRandom();
    expect(granted).toBeNull();
  });

  it("consume removes one instance of the given minor", () => {
    useMinorArcana.setState({
      heldIds: ["page-cups", "page-wands", "page-cups"],
    });
    useMinorArcana.getState().consume("page-cups");
    expect(useMinorArcana.getState().heldIds).toEqual(["page-wands", "page-cups"]);
  });

  it("consume is a no-op when the minor isn't held", () => {
    useMinorArcana.setState({ heldIds: ["page-cups"] });
    useMinorArcana.getState().consume("page-wands");
    expect(useMinorArcana.getState().heldIds).toEqual(["page-cups"]);
  });

  it("held() rehydrates minor objects from stored ids", () => {
    useMinorArcana.setState({ heldIds: ["page-cups"] });
    const held = useMinorArcana.getState().held();
    expect(held).toHaveLength(1);
    expect(held[0]!.name).toBe("Page of Cups");
  });

  it("held() filters out unknown ids (forward-compat for removed minors)", () => {
    useMinorArcana.setState({ heldIds: ["page-cups", "not-real" as never] });
    expect(useMinorArcana.getState().held().map((m) => m.id)).toEqual([
      "page-cups",
    ]);
  });

  it("isFull is true at MAX_HELD_MINORS held", () => {
    const ids = MINOR_ARCANA.slice(0, MAX_HELD_MINORS).map((m) => m.id);
    useMinorArcana.setState({ heldIds: ids });
    expect(useMinorArcana.getState().isFull()).toBe(true);
  });
});

describe("useGame — imperative consumable actions", () => {
  beforeEach(() => {
    useGame.getState().start("free", { seed: 7, rows: 5, cols: 5 });
  });

  it("destroyRandomRow leaves a settled board with the same dimensions", () => {
    const before = useGame.getState().board;
    useGame.getState().destroyRandomRow();
    const after = useGame.getState().board;
    expect(after.tiles).toHaveLength(before.tiles.length);
    for (const t of after.tiles) expect(t).not.toBeNull();
    expect(findMatches(after)).toEqual([]);
  });

  it("destroyRandomCol leaves a settled board with the same dimensions", () => {
    const before = useGame.getState().board;
    useGame.getState().destroyRandomCol();
    const after = useGame.getState().board;
    expect(after.tiles).toHaveLength(before.tiles.length);
    for (const t of after.tiles) expect(t).not.toBeNull();
    expect(findMatches(after)).toEqual([]);
  });

  it("convertBoardSuit settles to a match-free board after any cascade", () => {
    // The conversion itself can create matches (3+ cups in a row); the
    // refill that resolves them draws fresh random tiles, so we can't
    // assert "no swords remain" after the cascade. We can assert the
    // board ends up settled and the same size.
    const before = useGame.getState().board;
    useGame.getState().convertBoardSuit("swords", "cups");
    const after = useGame.getState().board;
    expect(after.tiles).toHaveLength(before.tiles.length);
    for (const t of after.tiles) expect(t).not.toBeNull();
    expect(findMatches(after)).toEqual([]);
  });

  it("reshuffleBoard yields a new settled board, no score change", () => {
    const beforeScore = useGame.getState().score;
    const beforeBoard = useGame.getState().board;
    useGame.getState().reshuffleBoard();
    const after = useGame.getState().board;
    expect(after.tiles).toHaveLength(beforeBoard.tiles.length);
    expect(findMatches(after)).toEqual([]);
    expect(useGame.getState().score).toBe(beforeScore);
  });

  it("pentaclePayout grants score = pentacle count × perPentacle", () => {
    const beforeScore = useGame.getState().score;
    const board = useGame.getState().board;
    const pentacles = board.tiles.filter(
      (t) => t && !t.kind && t.suit === "pentacles",
    ).length;
    useGame.getState().pentaclePayout(20);
    const after = useGame.getState().score;
    expect(after).toBe(beforeScore + pentacles * 20);
  });
});

describe("useGame — chamber-once arcana abilities", () => {
  beforeEach(() => {
    useGame.getState().start("free", { seed: 11, rows: 5, cols: 5 });
  });

  it("replayLastMove grants the last move's score and marks Judgement used", () => {
    // Seed a fake lastMove value directly — easier than driving attemptSwap.
    useGame.setState({
      lastMove: { chips: 100, mult: 10, score: 1000, tick: 1 },
    });
    const before = useGame.getState().score;
    useGame.getState().replayLastMove();
    expect(useGame.getState().score).toBe(before + 1000);
    expect(useGame.getState().chamberAbilitiesUsed["judgement"]).toBe(true);
  });

  it("replayLastMove is a no-op the second time in the same chamber", () => {
    useGame.setState({
      lastMove: { chips: 100, mult: 10, score: 1000, tick: 1 },
    });
    useGame.getState().replayLastMove();
    const after1 = useGame.getState().score;
    useGame.getState().replayLastMove();
    expect(useGame.getState().score).toBe(after1);
  });

  it("replayLastMove is a no-op when no scored move yet", () => {
    const before = useGame.getState().score;
    useGame.getState().replayLastMove();
    expect(useGame.getState().score).toBe(before);
    expect(useGame.getState().chamberAbilitiesUsed["judgement"]).toBeUndefined();
  });

  it("fireWheelOfFortune marks the chamber ability used", () => {
    // Pre-seed held arcana so wheelSwap has something to do.
    useArcana.setState({ heldIds: ["magician"], offeredIds: [], drawSeed: 0 });
    useGame.getState().fireWheelOfFortune();
    expect(useGame.getState().chamberAbilitiesUsed["wheel"]).toBe(true);
  });

  it("fireWheelOfFortune is a no-op the second time in the same chamber", () => {
    useArcana.setState({ heldIds: ["magician", "empress"], offeredIds: [], drawSeed: 0 });
    useGame.getState().fireWheelOfFortune();
    const firstHeld = useArcana.getState().heldIds.slice();
    useGame.getState().fireWheelOfFortune();
    expect(useArcana.getState().heldIds).toEqual(firstHeld);
  });

  it("start() resets chamberAbilitiesUsed", () => {
    useGame.setState({ chamberAbilitiesUsed: { judgement: true, wheel: true } });
    useGame.getState().start("free", { seed: 22, rows: 5, cols: 5 });
    expect(useGame.getState().chamberAbilitiesUsed).toEqual({});
  });
});
