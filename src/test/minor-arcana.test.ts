import { describe, expect, it, beforeEach } from "vitest";
import {
  MAX_HELD_MINORS,
  MINOR_ARCANA,
  minorById,
} from "../game/minor-arcana";
import { useMinorArcana } from "../state/minor-arcana";
import { createRng } from "../game/engine/rng";

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
